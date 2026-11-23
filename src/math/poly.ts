import { C, cabs, cadd, cdiv, cmul, csub, toFrac, type Complex } from '../engine';

/** Horner, coefficients du plus haut degré au terme constant. */
export function polyEval(a: readonly number[], z: Complex): Complex {
  let r = C(a[0]);
  for (let i = 1; i < a.length; i++) r = cadd(cmul(r, z), C(a[i]));
  return r;
}

/**
 * Racines d'un polynôme réel (Durand–Kerner puis Newton),
 * nettoyées vers des rationnels simples quand c'est plus juste.
 */
export function polyRoots(coefs: readonly number[]): Complex[] {
  const n = coefs.length - 1;
  const a = coefs.map((c) => c / coefs[0]);
  const R = 1 + Math.max(...a.slice(1).map(Math.abs));
  let roots = Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n + 0.4;
    return C(R * 0.9 * Math.cos(t), R * 0.9 * Math.sin(t));
  });
  for (let it = 0; it < 3000; it++) {
    let delta = 0;
    for (let i = 0; i < n; i++) {
      let den = C(1);
      for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(roots[i], roots[j]));
      if (den.re === 0 && den.im === 0) den = C(1e-12);
      const q = cdiv(polyEval(a, roots[i]), den);
      roots[i] = csub(roots[i], q);
      delta = Math.max(delta, cabs(q));
    }
    if (delta < 1e-16) break;
  }
  const da = a.slice(0, -1).map((c, i) => c * (n - i));
  roots = roots.map((z) => {
    for (let k = 0; k < 8; k++) {
      const d = polyEval(da, z);
      if (cabs(d) < 1e-14) break;
      const s = cdiv(polyEval(a, z), d);
      z = csub(z, s);
      if (cabs(s) < 1e-16) break;
    }
    return z;
  });
  return roots
    .map((z) => {
      let { re, im } = z;
      if (Math.abs(im) < 1e-7 * Math.max(1, Math.abs(re))) im = 0;
      for (const which of ['re', 'im'] as const) {
        const v = which === 're' ? re : im;
        const f = toFrac(v, 1000);
        if (!f) continue;
        const cand = f.p / f.q;
        if (Math.abs(cand - v) >= 1e-6 * Math.max(1, Math.abs(v))) continue;
        const zc = which === 're' ? C(cand, im) : C(re, cand);
        if (cabs(polyEval(a, zc)) <= cabs(polyEval(a, C(re, im))) + 1e-12) {
          if (which === 're') re = cand;
          else im = cand;
        }
      }
      return C(Math.abs(re) < 1e-13 ? 0 : re, im);
    })
    .sort((p, q) => Number(p.im !== 0) - Number(q.im !== 0) || p.re - q.re || q.im - p.im);
}
