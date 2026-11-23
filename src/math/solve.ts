import { CalcError } from '../engine';

/** Résout f(x) = 0 près de x0 : Newton, puis recherche d'un changement de signe et dichotomie. */
export function solveReal(f: (x: number) => number, x0: number): number {
  let x = x0;
  for (let i = 0; i < 80; i++) {
    const fx = f(x);
    if (!isFinite(fx)) break;
    if (fx === 0) return x;
    const h = 1e-7 * Math.max(1, Math.abs(x));
    const d = (f(x + h) - f(x - h)) / (2 * h);
    if (!isFinite(d) || d === 0) break;
    const nx = x - fx / d;
    if (!isFinite(nx)) break;
    if (Math.abs(nx - x) <= 1e-14 * Math.max(1, Math.abs(x))) {
      x = nx;
      break;
    }
    x = nx;
  }
  const scale = Math.max(1, Math.abs(f(x0)) || 1);
  if (isFinite(f(x)) && Math.abs(f(x)) <= 1e-9 * scale) return x;

  for (const dir of [1, -1]) {
    let a = x0, fa = f(a);
    for (let k = 0; k < 90; k++) {
      const b = x0 + dir * 0.05 * Math.max(1, Math.abs(x0)) * Math.pow(1.35, k);
      const fb = f(b);
      if (isFinite(fa) && isFinite(fb) && Math.sign(fa) !== Math.sign(fb)) {
        let lo = a, hi = b, flo = fa;
        for (let j = 0; j < 200; j++) {
          const m = (lo + hi) / 2, fm = f(m);
          if (!isFinite(fm)) break;
          if (Math.sign(fm) === Math.sign(flo)) {
            lo = m;
            flo = fm;
          } else hi = m;
        }
        const r = (lo + hi) / 2;
        if (Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(fa), Math.abs(fb))) return r;
      }
      a = b;
      fa = fb;
    }
  }
  throw new CalcError('math', 'Aucune solution trouvée près de la valeur initiale');
}
