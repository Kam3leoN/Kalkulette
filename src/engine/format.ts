import { cabs, carg, type Complex } from './complex';
import type { Angle } from './evaluator';
import { gcdInt, toFrac, type Fraction } from './numeric';

const SUP: Readonly<Record<string, string>> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

/** Remplace le trait d'union par le vrai signe moins typographique. */
export const minus = (s: string): string => s.replace(/-/g, '−');

/** 10 chiffres significatifs ; notation ×10ⁿ hors de [10⁻⁶ ; 10¹⁰[. */
export function fmtReal(x: number, sig = 10): string {
  if (!isFinite(x)) return 'Erreur';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e10 || ax < 1e-6) {
    const [m, e] = x.toExponential(sig - 1).split('e');
    const mant = m.includes('.') ? m.replace(/\.?0+$/, '') : m;
    return minus(mant) + '×10' + String(parseInt(e, 10)).split('').map((c) => SUP[c]).join('');
  }
  let s = String(Number(x.toPrecision(sig)));
  if (/e/.test(s)) s = Number(x.toPrecision(sig)).toFixed(12).replace(/\.?0+$/, '');
  return minus(s);
}

export function fmtComplex(z: Complex): string {
  if (z.im === 0) return fmtReal(z.re);
  const imAbs = Math.abs(z.im);
  const imStr = (imAbs === 1 ? '' : fmtReal(imAbs)) + 'i';
  if (z.re === 0) return (z.im < 0 ? '−' : '') + imStr;
  return fmtReal(z.re) + (z.im < 0 ? ' − ' : ' + ') + imStr;
}

export function fmtPolar(z: Complex, angle: Angle): string {
  let th = carg(z);
  if (angle === 'deg') th = (th * 180) / Math.PI;
  return fmtReal(cabs(z)) + '∠' + fmtReal(th) + (angle === 'deg' ? '°' : '');
}

export const fracStr = (f: Fraction): string => (f.p < 0 ? '−' : '') + Math.abs(f.p) + '/' + f.q;

/** Forme exacte quand elle existe : fraction, racine (a√b/c) ou multiple de π. */
export function exactForm(x: number): string | null {
  if (!isFinite(x) || x === 0 || Number.isInteger(x)) return null;
  const fr = toFrac(x, 10000);
  if (fr && fr.q > 1) return fracStr(fr);
  const s = toFrac(x * x, 1000);
  if (s && s.p > 0 && s.p * s.q <= 1e7) {
    let r = s.p * s.q, k = 1;
    for (let f = 2; f * f <= r; f++) {
      while (r % (f * f) === 0) {
        r /= f * f;
        k *= f;
      }
    }
    if (r > 1 && r <= 1000) {
      const g = gcdInt(k, s.q), num = k / g, den = s.q / g;
      if (Math.abs((num * Math.sqrt(r)) / den - Math.abs(x)) <= 1e-11 * Math.abs(x)) {
        return (x < 0 ? '−' : '') + (num === 1 ? '' : num) + '√' + r + (den === 1 ? '' : '/' + den);
      }
    }
  }
  const pf = toFrac(x / Math.PI, 100);
  if (pf && Math.abs(pf.p) <= 1000) {
    const a = Math.abs(pf.p);
    return (pf.p < 0 ? '−' : '') + (a === 1 ? '' : a) + 'π' + (pf.q === 1 ? '' : '/' + pf.q);
  }
  return null;
}

/** Fraction courte si elle existe, sinon décimal (matrices, équations). */
export function fmtNice(x: number): string {
  const f = toFrac(x, 999);
  return f && f.q > 1 ? fracStr(f) : fmtReal(x);
}
