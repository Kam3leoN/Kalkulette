/** Nombre complexe ; un réel a im = 0. */
export interface Complex {
  re: number;
  im: number;
}

export const C = (re: number, im = 0): Complex => ({ re, im });
export const ONE = C(1);
export const I = C(0, 1);
export const NI = C(0, -1);

export const cadd = (a: Complex, b: Complex): Complex => C(a.re + b.re, a.im + b.im);
export const csub = (a: Complex, b: Complex): Complex => C(a.re - b.re, a.im - b.im);
export const cmul = (a: Complex, b: Complex): Complex =>
  a.im === 0 && b.im === 0 ? C(a.re * b.re) : C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);

/** Division brute (sans contrôle du zéro : à faire par l'appelant si nécessaire). */
export function cdiv(a: Complex, b: Complex): Complex {
  if (b.im === 0) return C(a.re / b.re, a.im / b.re);
  const d = b.re * b.re + b.im * b.im;
  return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

export const cabs = (z: Complex): number => Math.hypot(z.re, z.im);
export const carg = (z: Complex): number => Math.atan2(z.im, z.re);
export const isReal = (z: Complex): boolean => Math.abs(z.im) <= 1e-12 * Math.max(1, Math.abs(z.re));

export function cexp(z: Complex): Complex {
  const r = Math.exp(z.re);
  return z.im === 0 ? C(r) : C(r * Math.cos(z.im), r * Math.sin(z.im));
}

export function csqrt(z: Complex): Complex {
  if (z.im === 0) return z.re >= 0 ? C(Math.sqrt(z.re)) : C(0, Math.sqrt(-z.re));
  const r = cabs(z);
  return C(Math.sqrt((r + z.re) / 2), Math.sign(z.im) * Math.sqrt((r - z.re) / 2));
}

export const sinR = (w: Complex): Complex => C(Math.sin(w.re) * Math.cosh(w.im), Math.cos(w.re) * Math.sinh(w.im));
export const cosR = (w: Complex): Complex => C(Math.cos(w.re) * Math.cosh(w.im), -Math.sin(w.re) * Math.sinh(w.im));
