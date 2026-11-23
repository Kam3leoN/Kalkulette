import { CalcError } from '../engine';

export type Matrix = number[][];

/** Met à zéro le bruit d'arrondi relativement à l'échelle s. */
export const clean = (x: number, s = 1): number => (Math.abs(x) < 1e-12 * Math.max(1, s) ? 0 : x);

export const transpose = (a: Matrix): Matrix => a[0].map((_, j) => a.map((r) => r[j]));

export function multiply(a: Matrix, b: Matrix): Matrix {
  if (a[0].length !== b.length) throw new CalcError('math', 'Dimensions incompatibles : colonnes de la 1ʳᵉ ≠ lignes de la 2ᵉ');
  return a.map((r) => b[0].map((_, j) => r.reduce((s, v, k) => s + v * b[k][j], 0)));
}

export function addScaled(a: Matrix, b: Matrix, sign: 1 | -1): Matrix {
  if (a.length !== b.length || a[0].length !== b[0].length) {
    throw new CalcError('math', 'Dimensions incompatibles : les matrices doivent avoir la même taille');
  }
  return a.map((r, i) => r.map((v, j) => v + sign * b[i][j]));
}

export function assertSquare(a: Matrix): void {
  if (a.length !== a[0].length) throw new CalcError('math', 'Matrice carrée requise');
}

export function determinant(a: Matrix): number {
  assertSquare(a);
  const n = a.length, m = a.map((r) => r.slice());
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    if (m[p][k] === 0) return 0;
    if (p !== k) {
      [m[p], m[k]] = [m[k], m[p]];
      d = -d;
    }
    d *= m[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = m[i][k] / m[k][k];
      for (let j = k; j < n; j++) m[i][j] -= f * m[k][j];
    }
  }
  return d;
}

export function inverse(a: Matrix): Matrix {
  assertSquare(a);
  const n = a.length;
  const m = a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => Number(i === j))]);
  const scale = Math.max(...a.flat().map(Math.abs), 1);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    if (Math.abs(m[p][k]) < 1e-12 * scale) throw new CalcError('math', 'Matrice non inversible (déterminant nul)');
    [m[p], m[k]] = [m[k], m[p]];
    const pv = m[k][k];
    for (let j = 0; j < 2 * n; j++) m[k][j] /= pv;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = m[i][k];
      for (let j = 0; j < 2 * n; j++) m[i][j] -= f * m[k][j];
    }
  }
  return m.map((r) => r.slice(n));
}

export function rank(a: Matrix): number {
  const m = a.map((r) => r.slice()), rows = m.length, cols = m[0].length;
  const tol = 1e-10 * Math.max(1, ...a.flat().map(Math.abs));
  let rk = 0;
  for (let c = 0; c < cols && rk < rows; c++) {
    let p = rk;
    for (let i = rk + 1; i < rows; i++) if (Math.abs(m[i][c]) > Math.abs(m[p][c])) p = i;
    if (Math.abs(m[p][c]) <= tol) continue;
    [m[p], m[rk]] = [m[rk], m[p]];
    for (let i = rk + 1; i < rows; i++) {
      const f = m[i][c] / m[rk][c];
      for (let j = c; j < cols; j++) m[i][j] -= f * m[rk][j];
    }
    rk++;
  }
  return rk;
}

/** Résout un système carré donné sous forme de matrice augmentée [A | b]. */
export function solveLinear(augmented: Matrix): number[] {
  const n = augmented.length, m = augmented.map((r) => r.slice());
  const A = augmented.map((r) => r.slice(0, n));
  const rA = rank(A), rAb = rank(augmented);
  if (rA < n) {
    throw new CalcError('math', rAb > rA ? 'Aucune solution : le système est incompatible' : 'Infinité de solutions : les équations sont liées');
  }
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    [m[p], m[k]] = [m[k], m[p]];
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = m[i][k] / m[k][k];
      for (let j = k; j <= n; j++) m[i][j] -= f * m[k][j];
    }
  }
  return m.map((r, i) => r[n] / r[i]);
}

export type Vector = number[];
export const norm = (a: Vector): number => Math.hypot(...a);
export const dot = (a: Vector, b: Vector): number => a.reduce((s, v, i) => s + v * b[i], 0);
export function cross(a: Vector, b: Vector): Vector {
  const [a1, a2, a3 = 0] = a, [b1, b2, b3 = 0] = b;
  return [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1];
}
