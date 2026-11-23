import { mathErr } from './errors';

export interface Fraction {
  p: number;
  q: number;
}

export function gcdInt(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Approximation par fractions continues, dénominateur ≤ maxQ. */
export function toFrac(x: number, maxQ = 10000): Fraction | null {
  if (!isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  if (x > 1e12) return null;
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxQ) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(x - h1 / k1) <= 1e-11 * Math.max(1, x)) return { p: sign * h1, q: k1 };
    const f = b - a;
    if (f < 1e-15) break;
    b = 1 / f;
  }
  return null;
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function gamma(x: number): number {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}

export function factorial(x: number): number {
  if (Number.isInteger(x)) {
    if (x < 0) throw mathErr();
    if (x > 170) throw mathErr('Dépassement de capacité');
    let r = 1;
    for (let i = 2; i <= x; i++) r *= i;
    return r;
  }
  return gamma(x + 1);
}

export function needInt(x: number, nonNegative = false): number {
  if (!Number.isInteger(x) || (nonNegative && x < 0)) throw mathErr('Entier attendu');
  return x;
}

/** Intégration de Simpson adaptative. */
export function integrate(g: (x: number) => number, a: number, b: number): number {
  if (a === b) return 0;
  let evals = 0;
  const fa = g(a), fb = g(b), m = (a + b) / 2, fm = g(m);
  const whole = ((b - a) / 6) * (fa + 4 * fm + fb);
  const rec = (a: number, b: number, fa: number, fm: number, fb: number, whole: number, eps: number, depth: number): number => {
    const m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2;
    const flm = g(lm), frm = g(rm);
    evals += 2;
    if (evals > 400000) throw mathErr("L'intégrale ne converge pas");
    const left = ((m - a) / 6) * (fa + 4 * flm + fm);
    const right = ((b - m) / 6) * (fm + 4 * frm + fb);
    const d = left + right - whole;
    if (depth <= 0 || (depth < 44 && Math.abs(d) <= 15 * eps)) return left + right + d / 15;
    return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
  };
  const r = rec(a, b, fa, fm, fb, whole, 1e-11 * Math.max(1, Math.abs(whole)), 48);
  if (!isFinite(r)) throw mathErr();
  return r;
}
