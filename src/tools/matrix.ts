import { CalcError, fmtNice, fmtReal, toFrac } from '../engine';
import { addScaled, assertSquare, clean, determinant, inverse, multiply, rank, transpose, type Matrix } from '../math/linalg';
import { $, esc, fillSelect, inputValue } from '../ui/dom';
import { pushHistory } from '../ui/history';
import { evalReal } from '../ui/state';
import { bigValue, errorHtml, setResult } from './result';

type Name = 'A' | 'B';
interface Editor {
  r: number;
  c: number;
  /** saisies brutes (4 × 4, cases inutilisées conservées) */
  v: string[][];
}

const MAT: Record<Name, Editor> = {
  A: { r: 3, c: 3, v: [['2', '1', '-1'], ['-3', '-1', '2'], ['-2', '1', '2']] },
  B: { r: 3, c: 3, v: [['1', '0', '2'], ['0', '1', '0'], ['3', '-1', '1']] },
};
let last: Matrix | null = null;

function pad(m: Editor): void {
  for (let i = 0; i < 4; i++) {
    m.v[i] ??= [];
    for (let j = 0; j < 4; j++) m.v[i][j] ??= '';
  }
}

function cellGrid(name: Name): string {
  const m = MAT[name];
  pad(m);
  const cells = Array.from({ length: m.r }, (_, i) =>
    Array.from({ length: m.c }, (_, j) => `<k3-text-field id="m${name}${i}${j}" data-m="${name}" data-i="${i}" data-j="${j}" variant="outlined" no-form aria-label="${name} ligne ${i + 1} colonne ${j + 1}"></k3-text-field>`).join(''),
  ).join('');
  return `<div class="mgrid" style="grid-template-columns:repeat(${m.c},minmax(0,1fr))">${cells}</div>`;
}

function fillCells(name: Name): void {
  const m = MAT[name];
  for (let i = 0; i < m.r; i++) for (let j = 0; j < m.c; j++) $(`m${name}${i}${j}`, 'k3-text-field').value = m.v[i][j];
}

function redrawGrid(name: Name): void {
  $(`grid${name}`).innerHTML = cellGrid(name);
  fillCells(name);
}

function renderEditors(): void {
  const dims = [1, 2, 3, 4].map((n) => [n, String(n)] as const);
  const names: Name[] = ['A', 'B'];
  $('matEditors').innerHTML = names
    .map((n) => `<div class="surface"><div class="row between"><h3>Matrice ${n}</h3><div class="dims"><k3-select id="r${n}" label="Lignes"></k3-select><k3-select id="c${n}" label="Colonnes"></k3-select></div></div><div id="grid${n}" class="grid-wrap">${cellGrid(n)}</div></div>`)
    .join('');
  for (const n of names) {
    const rows = $(`r${n}`, 'k3-select'), cols = $(`c${n}`, 'k3-select');
    fillSelect(rows, dims, MAT[n].r);
    fillSelect(cols, dims, MAT[n].c);
    rows.addEventListener('k3-change', (e) => {
      MAT[n].r = Number(inputValue(e, rows));
      redrawGrid(n);
    });
    cols.addEventListener('k3-change', (e) => {
      MAT[n].c = Number(inputValue(e, cols));
      redrawGrid(n);
    });
    fillCells(n);
  }
}

function read(n: Name): Matrix {
  const m = MAT[n];
  return Array.from({ length: m.r }, (_, i) =>
    Array.from({ length: m.c }, (_, j) => {
      const field = document.getElementById(`m${n}${i}${j}`) as K3TextFieldElement | null;
      try {
        const v = evalReal(m.v[i][j]);
        if (field) field.error = '';
        return v;
      } catch (e) {
        if (field) field.error = ' ';
        throw new CalcError('syntax', `${n}(${i + 1},${j + 1}) : ${(e as Error).message}`);
      }
    }),
  );
}

const OPS: ReadonlyArray<readonly [string, () => Matrix | number]> = [
  ['A + B', () => addScaled(read('A'), read('B'), 1)],
  ['A − B', () => addScaled(read('A'), read('B'), -1)],
  ['A × B', () => multiply(read('A'), read('B'))],
  ['B × A', () => multiply(read('B'), read('A'))],
  ['det(A)', () => determinant(read('A'))],
  ['det(B)', () => determinant(read('B'))],
  ['A⁻¹', () => inverse(read('A'))],
  ['B⁻¹', () => inverse(read('B'))],
  ['Aᵀ', () => transpose(read('A'))],
  ['Bᵀ', () => transpose(read('B'))],
  ['A²', () => {
    const a = read('A');
    assertSquare(a);
    return multiply(a, a);
  }],
  ['rang(A)', () => rank(read('A'))],
];

function matrixHtml(m: Matrix): string {
  const s = Math.max(1, ...m.flat().map(Math.abs));
  return `<div class="mout" style="grid-template-columns:repeat(${m[0].length},auto)">${m.flat().map((v) => `<span>${esc(fmtNice(clean(v, s)))}</span>`).join('')}</div>`;
}

function run(i: number, record = true): void {
  const [label, fn] = OPS[i];
  const box = $('matResult');
  document.querySelectorAll('#matOps k3-button').forEach((b, k) => b.setAttribute('variant', k === i ? 'filled' : 'tonal'));
  try {
    const r = fn();
    if (Array.isArray(r)) {
      last = r;
      setResult(box, `<div class="rt">${esc(label)}</div>${matrixHtml(r)}<div class="row"><k3-button variant="filled" size="sm" id="toA">Copier dans A</k3-button><k3-button variant="outlined" size="sm" id="toB">Copier dans B</k3-button></div>`);
      $('toA').addEventListener('click', () => copyTo('A'));
      $('toB').addEventListener('click', () => copyTo('B'));
      if (record) {
        const flat = r.map((row) => row.map((v) => fmtNice(clean(v))).join(' ')).join(' ; ');
        pushHistory({ mode: 'matrix', tab: 'matrix', expr: label, tokens: [], result: `${r.length}×${r[0].length} : [${flat}]` });
      }
    } else {
      last = null;
      const v = clean(r);
      setResult(box, `<div class="rt">${esc(label)}</div>${bigValue(v)}`);
      if (record) pushHistory({ mode: 'matrix', tab: 'matrix', expr: label, tokens: [], result: fmtReal(v) });
    }
  } catch (e) {
    setResult(box, errorHtml(label, e), true);
  }
}

function copyTo(n: Name): void {
  if (!last) return;
  const r = last;
  MAT[n] = {
    r: r.length,
    c: r[0].length,
    v: r.map((row) => row.map((v) => {
      const f = toFrac(clean(v), 999);
      return f && f.q > 1 ? `${f.p}/${f.q}` : String(+clean(v).toPrecision(12));
    })),
  };
  renderEditors();
}

export function initMatrix(): void {
  renderEditors();
  $('matEditors').addEventListener('k3-input', (e) => {
    const t = (e.target as HTMLElement).closest<K3TextFieldElement>('k3-text-field');
    const name = t?.dataset.m as Name | undefined;
    if (!t || !name) return;
    MAT[name].v[Number(t.dataset.i)][Number(t.dataset.j)] = inputValue(e, t);
    t.error = '';
  });
  $('matOps').innerHTML = OPS.map(([l], i) => `<k3-button variant="tonal" size="sm" data-op="${i}">${esc(l)}</k3-button>`).join('');
  $('matOps').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-op]');
    if (b) run(Number(b.dataset.op));
  });
  run(6, false); /* A⁻¹ à l'ouverture, comme exemple */
}
