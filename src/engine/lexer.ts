import { synErr } from './errors';

export type FnName =
  | 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan'
  | 'sinh' | 'cosh' | 'tanh' | 'asinh' | 'acosh' | 'atanh'
  | 'ln' | 'log' | 'sqrt' | 'cbrt' | 'root' | 'abs' | 'exp'
  | 'nCr' | 'nPr' | 'mod' | 'gcd' | 'lcm' | 'round' | 'floor' | 'ceil' | 'int'
  | 'integ' | 'deriv' | 'sum' | 're' | 'im' | 'arg' | 'conj' | 'ranint';
export type ConstName = 'pi' | 'e' | 'i' | 'ans' | 'ran';
export const VAR_NAMES = ['A', 'B', 'C', 'D', 'X', 'Y'] as const;
export type VarName = (typeof VAR_NAMES)[number];
export type BinOp = '+' | '-' | '*' | '/' | '^';
export type PostOp = '!' | '%' | '²' | '³' | '⁻¹';
export type OpSymbol = BinOp | PostOp;

/** Noms tels qu'ils s'écrivent (touches et clavier) → fonction interne. */
export const FN: Readonly<Record<string, FnName>> = {
  sin: 'sin', cos: 'cos', tan: 'tan', 'sin⁻¹': 'asin', 'cos⁻¹': 'acos', 'tan⁻¹': 'atan', asin: 'asin', acos: 'acos', atan: 'atan',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', 'sinh⁻¹': 'asinh', 'cosh⁻¹': 'acosh', 'tanh⁻¹': 'atanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh',
  ln: 'ln', log: 'log', '√': 'sqrt', sqrt: 'sqrt', '∛': 'cbrt', cbrt: 'cbrt', 'ˣ√': 'root', root: 'root', Abs: 'abs', abs: 'abs', exp: 'exp',
  nCr: 'nCr', nPr: 'nPr', mod: 'mod', gcd: 'gcd', lcm: 'lcm', round: 'round', Rnd: 'round', floor: 'floor', ceil: 'ceil', Int: 'int',
  '∫': 'integ', 'd/dx': 'deriv', 'Σ': 'sum', Re: 're', Im: 'im', arg: 'arg', conj: 'conj', RanInt: 'ranint',
};
export const CONSTS: Readonly<Record<string, ConstName>> = { 'π': 'pi', pi: 'pi', e: 'e', i: 'i', Ans: 'ans', 'Ran#': 'ran' };
export const VARS: Readonly<Record<string, VarName>> = { A: 'A', B: 'B', C: 'C', D: 'D', X: 'X', Y: 'Y', x: 'X', y: 'Y' };
/** Nombre d'arguments [min, max] ; 1 par défaut. */
export const ARITY: Partial<Record<FnName, readonly [number, number]>> = {
  log: [1, 2], root: [2, 2], nCr: [2, 2], nPr: [2, 2], mod: [2, 2], gcd: [2, 2], lcm: [2, 2],
  round: [1, 2], integ: [3, 3], deriv: [2, 2], sum: [3, 3], ranint: [2, 2],
};

type IdKind = 'fn' | 'const' | 'var';
const NAMES: ReadonlyArray<readonly [string, IdKind]> = [
  ...Object.keys(FN).map((n) => [n, 'fn'] as const),
  ...Object.keys(CONSTS).map((n) => [n, 'const'] as const),
  ...Object.keys(VARS).map((n) => [n, 'var'] as const),
].sort((a, b) => b[0].length - a[0].length);

const OPMAP: Readonly<Record<string, OpSymbol>> = {
  '+': '+', '-': '-', '−': '-', '×': '*', '*': '*', '·': '*', '÷': '/', '/': '/', '^': '^', '!': '!', '%': '%', '²': '²', '³': '³',
};

export type Token =
  | { k: 'num'; v: number }
  | { k: 'id'; v: string; kind: IdKind }
  | { k: 'op'; v: OpSymbol }
  | { k: '(' | ')' | ',' | '=' };

const NUMBER = /^(\d+\.?\d*|\.\d+)(?:[ᴇE]([−\-+]?\d+))?/;

export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = s.slice(i);
    const m = NUMBER.exec(rest);
    if (m) {
      const exp = m[2] !== undefined ? 'e' + m[2].replace('−', '-') : '';
      out.push({ k: 'num', v: parseFloat(m[1] + exp) });
      i += m[0].length;
      continue;
    }
    if (ch === 'ᴇ') {
      const m2 = /^ᴇ([−\-+]?\d+)/.exec(rest);
      if (!m2) throw synErr();
      out.push({ k: 'num', v: parseFloat('1e' + m2[1].replace('−', '-')) });
      i += m2[0].length;
      continue;
    }
    if (rest.startsWith('⁻¹')) { out.push({ k: 'op', v: '⁻¹' }); i += 2; continue; }
    const hit = NAMES.find(([n]) => rest.startsWith(n));
    if (hit) { out.push({ k: 'id', v: hit[0], kind: hit[1] }); i += hit[0].length; continue; }
    const op = OPMAP[ch];
    if (op) { out.push({ k: 'op', v: op }); i++; continue; }
    if (ch === '(' || ch === ')' || ch === ',' || ch === '=') { out.push({ k: ch }); i++; continue; }
    throw synErr(`Symbole inconnu « ${ch} »`);
  }
  return out;
}

/** Variables citées dans une expression, dans l'ordre d'apparition (vide si l'expression est invalide). */
export function variablesIn(src: string): VarName[] {
  try {
    const seen: VarName[] = [];
    for (const t of tokenize(src)) {
      if (t.k === 'id' && t.kind === 'var') {
        const v = VARS[t.v];
        if (!seen.includes(v)) seen.push(v);
      }
    }
    return seen;
  } catch {
    return [];
  }
}
