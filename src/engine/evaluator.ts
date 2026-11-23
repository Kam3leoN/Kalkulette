import {
  C, I, NI, ONE, cabs, cadd, carg, cdiv, cexp, cmul, cosR, csqrt, csub, isReal, sinR, type Complex,
} from './complex';
import { mathErr, synErr } from './errors';
import type { VarName } from './lexer';
import { factorial, gcdInt, integrate, needInt, toFrac } from './numeric';
import { astHas, type Node } from './parser';

export type Mode = 'comp' | 'cmplx' | 'calc';
export type Angle = 'deg' | 'rad';

export interface EvalOptions {
  mode: Mode;
  angle: Angle;
  vars: Readonly<Record<VarName, Complex>>;
  ans: Complex;
  /** Variables liées localement (X d'une intégrale, inconnue de SOLVE…). */
  local?: Readonly<Partial<Record<VarName, number>>> | null;
  allowEq?: boolean;
}

/* Contexte de l'évaluation en cours (les fonctions ci-dessous en dépendent : mode, unité d'angle). */
let ENV: EvalOptions = { mode: 'comp', angle: 'deg', vars: {} as Record<VarName, Complex>, ans: C(0), local: null };
const PI = Math.PI;

const toRad = (x: number): number => (ENV.angle === 'deg' ? (x * PI) / 180 : x);
const fromRad = (x: number): number => (ENV.angle === 'deg' ? (x * 180) / PI : x);
const toRadZ = (z: Complex): Complex => (ENV.angle === 'deg' ? C((z.re * PI) / 180, (z.im * PI) / 180) : z);
const fromRadZ = (z: Complex): Complex => (ENV.angle === 'deg' ? C((z.re * 180) / PI, (z.im * 180) / PI) : z);

function cln(z: Complex): Complex {
  if (z.re === 0 && z.im === 0) throw mathErr();
  if (z.im === 0 && z.re > 0) return C(Math.log(z.re));
  return C(Math.log(cabs(z)), carg(z));
}

function cpow(a: Complex, b: Complex): Complex {
  if (a.im === 0 && b.im === 0) {
    if (a.re === 0) {
      if (b.re > 0) return C(0);
      throw mathErr();
    }
    if (a.re > 0 || Number.isInteger(b.re)) return C(Math.pow(a.re, b.re));
    /* hors CMPLX, (−8)^(1/3) = −2 : racine réelle des exposants à dénominateur impair */
    if (ENV.mode !== 'cmplx') {
      const fr = toFrac(b.re, 99);
      if (fr && Math.abs(fr.q) % 2 === 1) {
        const v = Math.pow(-a.re, b.re);
        return C(Math.abs(fr.p) % 2 === 0 ? v : -v);
      }
    }
  }
  if (a.re === 0 && a.im === 0) {
    if (b.re > 0) return C(0);
    throw mathErr();
  }
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    let r = C(1), base = a, n = Math.abs(b.re);
    while (n) {
      if (n & 1) r = cmul(r, base);
      base = cmul(base, base);
      n >>= 1;
    }
    return b.re < 0 ? cdiv(ONE, r) : r;
  }
  return cexp(cmul(b, cln(a)));
}

type TrigName = 'sin' | 'cos' | 'tan';
/** Trigonométrie réelle, valeurs exactes aux multiples de 90° en mode DEG. */
function realTrig(f: TrigName, x: number): number {
  if (ENV.angle === 'deg') {
    const r = ((x % 360) + 360) % 360;
    if (r % 90 === 0) {
      const q = r / 90;
      if (f === 'sin') return [0, 1, 0, -1][q];
      if (f === 'cos') return [1, 0, -1, 0][q];
      if (q % 2 === 1) throw mathErr();
      return 0;
    }
  }
  const rad = toRad(x);
  if (f === 'tan' && Math.abs(Math.cos(rad)) < 1e-15) throw mathErr();
  const v = Math[f](rad);
  if (Math.abs(v) < 1e-15 && Math.abs(rad) > 1e-3) return 0;
  return v;
}

const casinR = (z: Complex): Complex => cmul(NI, cln(cadd(cmul(I, z), csqrt(csub(ONE, cmul(z, z))))));
const catanR = (z: Complex): Complex => cmul(C(0, 0.5), csub(cln(csub(ONE, cmul(I, z))), cln(cadd(ONE, cmul(I, z)))));
const csinh = (z: Complex): Complex => cmul(C(0.5), csub(cexp(z), cexp(C(-z.re, -z.im))));
const ccosh = (z: Complex): Complex => cmul(C(0.5), cadd(cexp(z), cexp(C(-z.re, -z.im))));

const realOf = (z: Complex): number => {
  if (!isReal(z)) throw mathErr('Argument réel attendu');
  return z.re;
};

function withX<T>(x: number, fn: () => T): T {
  const prev = ENV.local;
  ENV.local = { ...prev, X: x };
  try {
    return fn();
  } finally {
    ENV.local = prev;
  }
}
function evalRealAt(node: Node, x: number): number {
  return withX(x, () => {
    const z = ev(node);
    if (!isReal(z)) throw mathErr();
    return z.re;
  });
}

function callFn(node: Extract<Node, { t: 'fn' }>): Complex {
  const { n: name, args } = node;
  /* fonctions à évaluation différée : leur premier argument dépend de X */
  if (name === 'integ') {
    const a = realOf(ev(args[1])), b = realOf(ev(args[2]));
    return C(integrate((x) => evalRealAt(args[0], x), a, b));
  }
  if (name === 'deriv') {
    const a = realOf(ev(args[1]));
    const f = (x: number): number => evalRealAt(args[0], x);
    const h = 1e-3 * Math.max(1, Math.abs(a));
    const D = (h: number): number => (f(a + h) - f(a - h)) / (2 * h);
    const d1 = D(h), d2 = D(h / 2), d3 = D(h / 4);
    const r1 = (4 * d2 - d1) / 3, r2 = (4 * d3 - d2) / 3;
    const r = (16 * r2 - r1) / 15;
    if (!isFinite(r)) throw mathErr();
    return C(Math.abs(r) < 1e-10 ? 0 : r);
  }
  if (name === 'sum') {
    const a = needInt(realOf(ev(args[1]))), b = needInt(realOf(ev(args[2])));
    if (b < a) throw mathErr('Bornes inversées');
    if (b - a > 1e6) throw mathErr('Trop de termes');
    let s = C(0);
    for (let k = a; k <= b; k++) s = cadd(s, withX(k, () => ev(args[0])));
    return s;
  }

  const v = args.map(ev);
  const z = v[0];
  switch (name) {
    case 'sin': return z.im === 0 ? C(realTrig('sin', z.re)) : sinR(toRadZ(z));
    case 'cos': return z.im === 0 ? C(realTrig('cos', z.re)) : cosR(toRadZ(z));
    case 'tan': {
      if (z.im === 0) return C(realTrig('tan', z.re));
      const w = toRadZ(z);
      return cdiv(sinR(w), cosR(w));
    }
    case 'asin': return z.im === 0 && Math.abs(z.re) <= 1 ? C(fromRad(Math.asin(z.re))) : fromRadZ(casinR(z));
    case 'acos': return z.im === 0 && Math.abs(z.re) <= 1 ? C(fromRad(Math.acos(z.re))) : fromRadZ(csub(C(PI / 2), casinR(z)));
    case 'atan': return z.im === 0 ? C(fromRad(Math.atan(z.re))) : fromRadZ(catanR(z));
    case 'sinh': return z.im === 0 ? C(Math.sinh(z.re)) : csinh(z);
    case 'cosh': return z.im === 0 ? C(Math.cosh(z.re)) : ccosh(z);
    case 'tanh': return z.im === 0 ? C(Math.tanh(z.re)) : cdiv(csinh(z), ccosh(z));
    case 'asinh': return z.im === 0 ? C(Math.asinh(z.re)) : cln(cadd(z, csqrt(cadd(cmul(z, z), ONE))));
    case 'acosh':
      return z.im === 0 && z.re >= 1 ? C(Math.acosh(z.re)) : cln(cadd(z, cmul(csqrt(cadd(z, ONE)), csqrt(csub(z, ONE)))));
    case 'atanh':
      if (z.im === 0 && Math.abs(z.re) === 1) throw mathErr();
      return z.im === 0 && Math.abs(z.re) < 1 ? C(Math.atanh(z.re)) : cmul(C(0.5), csub(cln(cadd(ONE, z)), cln(csub(ONE, z))));
    case 'ln': return cln(z);
    case 'log': {
      if (v.length === 2) {
        const lb = cln(v[0]);
        if (cabs(lb) === 0) throw mathErr();
        return cdiv(cln(v[1]), lb);
      }
      if (z.im === 0 && z.re > 0) return C(Math.log10(z.re));
      return cdiv(cln(z), C(Math.LN10));
    }
    case 'sqrt': return csqrt(z);
    case 'cbrt': return z.im === 0 ? C(Math.cbrt(z.re)) : cpow(z, C(1 / 3));
    case 'root': {
      const [k, x] = v;
      if (k.im === 0 && x.im === 0) {
        if (k.re === 0) throw mathErr();
        if (x.re >= 0) return C(Math.pow(x.re, 1 / k.re));
        if (Number.isInteger(k.re) && Math.abs(k.re) % 2 === 1 && ENV.mode !== 'cmplx') return C(-Math.pow(-x.re, 1 / k.re));
      }
      return cpow(x, cdiv(ONE, k));
    }
    case 'abs': return C(cabs(z));
    case 'exp': return cexp(z);
    case 'nCr':
    case 'nPr': {
      const nn = needInt(realOf(v[0]), true), r = needInt(realOf(v[1]), true);
      if (r > nn) throw mathErr();
      if (name === 'nPr') {
        let s = 1;
        for (let k = 0; k < r; k++) s *= nn - k;
        return C(s);
      }
      const kk = Math.min(r, nn - r);
      let s = 1;
      for (let k = 1; k <= kk; k++) s = (s * (nn - kk + k)) / k;
      return C(Math.round(s));
    }
    case 'mod': {
      const a = realOf(v[0]), b = realOf(v[1]);
      if (b === 0) throw mathErr();
      return C(((a % b) + b) % b);
    }
    case 'gcd': return C(gcdInt(needInt(realOf(v[0])), needInt(realOf(v[1]))));
    case 'lcm': {
      const a = needInt(realOf(v[0])), b = needInt(realOf(v[1]));
      return C(a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcdInt(a, b));
    }
    case 'round': {
      const d = v.length > 1 ? needInt(realOf(v[1])) : 0;
      const f = Math.pow(10, d);
      return C(Math.round(realOf(z) * f) / f);
    }
    case 'floor': return C(Math.floor(realOf(z)));
    case 'ceil': return C(Math.ceil(realOf(z)));
    case 'int': return C(Math.trunc(realOf(z)));
    case 're': return C(z.re);
    case 'im': return C(z.im);
    case 'arg': return C(fromRad(carg(z)));
    case 'conj': return C(z.re, -z.im);
    case 'ranint': {
      const a = needInt(realOf(v[0])), b = needInt(realOf(v[1]));
      if (b < a) throw mathErr();
      return C(a + Math.floor(Math.random() * (b - a + 1)));
    }
  }
}

function ev(n: Node): Complex {
  switch (n.t) {
    case 'num': return C(n.v);
    case 'const':
      switch (n.n) {
        case 'pi': return C(PI);
        case 'e': return C(Math.E);
        case 'i': return C(0, 1);
        case 'ans': return ENV.ans;
        case 'ran': return C(Math.round(Math.random() * 1000) / 1000);
      }
      break;
    case 'var': {
      const local = ENV.local?.[n.n];
      return local !== undefined ? C(local) : ENV.vars[n.n] ?? C(0);
    }
    case 'neg': {
      const a = ev(n.a);
      return C(-a.re, -a.im);
    }
    case 'eq': return csub(ev(n.a), ev(n.b));
    case 'fn': return callFn(n);
    case 'post': {
      const a = ev(n.a);
      switch (n.op) {
        case '²': return cmul(a, a);
        case '³': return cmul(cmul(a, a), a);
        case '⁻¹':
          if (a.re === 0 && a.im === 0) throw mathErr();
          return cdiv(ONE, a);
        case '%': return C(a.re / 100, a.im / 100);
        case '!': return C(factorial(realOf(a)));
      }
      break;
    }
    case 'bin': {
      const a = ev(n.a), b = ev(n.b);
      switch (n.op) {
        case '+': return cadd(a, b);
        case '-': return csub(a, b);
        case '*': return cmul(a, b);
        case '/':
          if (b.re === 0 && b.im === 0) throw mathErr('Division par zéro');
          return cdiv(a, b);
        case '^': return cpow(a, b);
      }
    }
  }
  throw synErr();
}

/** Nettoie le bruit d'arrondi (partie imaginaire ou réelle négligeable). */
function cleanZ(z: Complex): Complex {
  let { re, im } = z;
  if (Math.abs(im) <= 1e-13 * Math.max(1, Math.abs(re))) im = 0;
  if (im !== 0 && Math.abs(re) <= 1e-14 * Math.abs(im)) re = 0;
  return C(re === 0 ? 0 : re, im === 0 ? 0 : im);
}

/** Évalue un arbre avec les règles du mode choisi (erreurs en français). */
export function runAst(ast: Node, opts: EvalOptions): Complex {
  const prev = ENV;
  ENV = { ...opts, local: opts.local ?? null };
  try {
    if (ast.t === 'eq' && opts.mode !== 'calc' && !opts.allowEq) throw synErr('Le signe = sert aux équations du mode CALC');
    if (opts.mode !== 'cmplx' && astHas(ast, (n) => n.t === 'const' && n.n === 'i')) throw synErr("i n'existe qu'en mode CMPLX");
    let z = ev(ast);
    if (!isFinite(z.re) || !isFinite(z.im)) throw mathErr('Dépassement de capacité');
    z = cleanZ(z);
    if (opts.mode !== 'cmplx' && z.im !== 0) throw mathErr('Résultat complexe : passez en CMPLX');
    return z;
  } finally {
    ENV = prev;
  }
}

/** Fonction réelle d'une variable (NaN hors domaine) : graphe, SOLVE. */
export function makeRealFn(ast: Node, opts: Omit<EvalOptions, 'mode' | 'local'>, varName: VarName = 'X'): (x: number) => number {
  return (x) => {
    const prev = ENV;
    ENV = { ...opts, mode: 'comp', local: { [varName]: x } };
    try {
      const z = ev(ast);
      return isFinite(z.re) && Math.abs(z.im) <= 1e-9 * Math.max(1, Math.abs(z.re)) ? z.re : NaN;
    } catch {
      return NaN; /* hors domaine : le graphe s'interrompt simplement */
    } finally {
      ENV = prev;
    }
  };
}
