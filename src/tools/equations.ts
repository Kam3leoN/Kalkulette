import { C, CalcError, exactForm, fmtComplex, fmtNice, type Complex } from '../engine';
import { clean, solveLinear } from '../math/linalg';
import { polyRoots } from '../math/poly';
import { $, esc, fromPath, inputValue } from '../ui/dom';
import { pushHistory } from '../ui/history';
import { evalReal } from '../ui/state';
import { errorHtml, setResult } from './result';

type LinType = 'lin2' | 'lin3';
type PolyType = 'poly2' | 'poly3' | 'poly4';
type EqType = LinType | PolyType;

const EQ_TYPES: ReadonlyArray<readonly [EqType, string]> = [
  ['lin2', 'Système 2 inconnues'],
  ['lin3', 'Système 3 inconnues'],
  ['poly2', 'ax² + bx + c = 0'],
  ['poly3', 'Degré 3'],
  ['poly4', 'Degré 4'],
];
const SUBS = '₁₂₃₄₅';
const SUP = '⁰¹²³⁴';
const XYZ = ['x', 'y', 'z'];

const EQ: { type: EqType; lin: Record<LinType, string[][]>; poly: Record<PolyType, string[]> } = {
  type: 'poly2',
  lin: { lin2: [['2', '3', '8'], ['1', '-1', '-1']], lin3: [['1', '1', '1', '6'], ['0', '2', '5', '-4'], ['2', '5', '-1', '27']] },
  poly: { poly2: ['1', '-2', '5'], poly3: ['1', '-6', '11', '-6'], poly4: ['1', '0', '-5', '0', '4'] },
};
const isLin = (t: EqType): t is LinType => t === 'lin2' || t === 'lin3';
const degreeOf = (t: PolyType): number => Number(t[4]);

function renderTypes(): void {
  $('eqTypes').innerHTML = EQ_TYPES.map(([k, l]) => `<k3-chip variant="filter" value="${k}"${EQ.type === k ? ' selected' : ''}>${esc(l)}</k3-chip>`).join('');
}

function renderGrid(): void {
  const t = EQ.type, g = $('eqGrid');
  if (isLin(t)) {
    const n = t === 'lin2' ? 2 : 3;
    g.style.gridTemplateColumns = `auto repeat(${n + 1},minmax(0,1fr))`;
    g.innerHTML = EQ.lin[t]
      .map((row, i) => `<span class="rl">(${i + 1})</span>` + row.map((_, j) => `<k3-text-field id="eq${i}${j}" data-i="${i}" data-j="${j}" variant="outlined" no-form label="${j < n ? 'coef. ' + XYZ[j] : '= second membre'}"></k3-text-field>`).join(''))
      .join('');
    EQ.lin[t].forEach((row, i) => row.forEach((v, j) => ($(`eq${i}${j}`, 'k3-text-field').value = v)));
  } else {
    const d = degreeOf(t);
    const names = 'abcde'.slice(0, d + 1).split('');
    g.style.gridTemplateColumns = `repeat(${d + 1},minmax(0,1fr))`;
    g.innerHTML = names
      .map((nm, j) => `<k3-text-field id="eq0${j}" data-i="-1" data-j="${j}" variant="outlined" no-form label="${nm}${d - j > 0 ? ' · x' + (d - j > 1 ? SUP[d - j] : '') : ''}"></k3-text-field>`)
      .join('');
    EQ.poly[t].forEach((v, j) => ($(`eq0${j}`, 'k3-text-field').value = v));
  }
}

/** Écriture lisible d'un polynôme ou d'un membre d'équation (termes nuls omis). */
function polyStr(coefs: number[], vars: string[]): string {
  let s = '';
  coefs.forEach((c, i) => {
    if (c === 0) return;
    const v = vars[i], a = Math.abs(c);
    const term = (a === 1 && v ? '' : fmtNice(a).replace('−', '')) + v;
    s = s ? s + (c < 0 ? ' − ' : ' + ') + term : (c < 0 ? '−' : '') + term;
  });
  return s || '0';
}

function solRow(label: string, z: Complex): string {
  const ex = z.im === 0 ? exactForm(z.re) : null;
  return `<div class="sol"><span class="k">${esc(label)} =</span><span>${esc(fmtComplex(z))}</span>${ex ? `<span class="exact">${esc(ex)}</span>` : ''}</div>`;
}

function solveLin(t: LinType, record: boolean): void {
  const n = t === 'lin2' ? 2 : 3, vars = XYZ.slice(0, n);
  const ab = EQ.lin[t].map((row, i) => row.map((v, j) => evalReal(v, `(${i + 1}) ${j < n ? vars[j] : '='}`)));
  const lines = ab.map((r) => polyStr(r.slice(0, n), vars) + ' = ' + fmtNice(r[n]));
  $('eqPrev').innerHTML = lines.map(esc).join('<br>');
  const sol = solveLinear(ab);
  const scale = Math.max(...sol.map(Math.abs));
  setResult($('eqResult'), `<div class="rt">Solution</div><div class="sols">${sol.map((v, i) => solRow(vars[i], C(clean(v, scale)))).join('')}</div>`);
  if (record) pushHistory({ mode: 'eqn', tab: 'eqn', tokens: [], expr: lines.join(' ; '), result: sol.map((v, i) => `${vars[i]} = ${fmtNice(clean(v))}`).join(', ') });
}

function solvePoly(t: PolyType, record: boolean): void {
  const d = degreeOf(t);
  const co = EQ.poly[t].map((v, j) => evalReal(v, 'abcde'[j]));
  const vars = Array.from({ length: d + 1 }, (_, k) => (d - k === 0 ? '' : 'x' + (d - k > 1 ? SUP[d - k] : '')));
  const text = polyStr(co, vars) + ' = 0';
  $('eqPrev').textContent = text;
  if (co[0] === 0) throw new CalcError('math', 'Le coefficient a doit être non nul');
  let roots: Complex[];
  let facts = '';
  if (d === 2) {
    const [a, b, c] = co, D = b * b - 4 * a * c;
    if (D > 0) {
      /* forme stable numériquement */
      const q = -(b + Math.sign(b || 1) * Math.sqrt(D)) / 2;
      roots = [C(q / a), C(q === 0 ? 0 : c / q)].sort((u, v) => u.re - v.re);
    } else if (D === 0) roots = [C(-b / (2 * a))];
    else {
      const re = clean(-b / (2 * a)), im = Math.sqrt(-D) / (2 * Math.abs(a));
      roots = [C(re, im), C(re, -im)];
    }
    const vx = -b / (2 * a), vy = c - (b * b) / (4 * a);
    facts = `<div class="facts"><span>Δ = <b>${esc(fmtNice(D))}</b></span><span>${a > 0 ? 'Minimum' : 'Maximum'} en (<b>${esc(fmtNice(clean(vx)))}</b> ; <b>${esc(fmtNice(clean(vy)))}</b>)</span></div>`;
  } else roots = polyRoots(co);
  const label = (i: number): string => (roots.length === 1 ? 'x' : 'x' + SUBS[i]);
  setResult($('eqResult'), `<div class="rt">${roots.length === 1 ? 'Racine double' : 'Racines'}</div><div class="sols">${roots.map((z, i) => solRow(label(i), z)).join('')}</div>${facts}`);
  if (record) pushHistory({ mode: 'eqn', tab: 'eqn', tokens: [], expr: text, result: roots.map(fmtComplex).join(' ; ') });
}

function solve(record = false): void {
  try {
    if (isLin(EQ.type)) solveLin(EQ.type, record);
    else solvePoly(EQ.type, record);
  } catch (e) {
    setResult($('eqResult'), errorHtml('Résolution impossible', e), true);
  }
}

export function initEquations(): void {
  renderTypes();
  renderGrid();
  $('eqTypes').addEventListener('k3-change', (e) => {
    const chip = (e as CustomEvent<K3ChipSetDetail>).detail?.chip ?? fromPath<K3ChipElement>(e, 'k3-chip');
    const v = chip?.value as EqType | undefined;
    /* choix unique obligatoire : un second appui ne désélectionne pas */
    if (!chip || !v || !chip.selected) {
      renderTypes();
      return;
    }
    if (v !== EQ.type) {
      EQ.type = v;
      renderGrid();
      solve();
    }
  });
  $('eqGrid').addEventListener('k3-input', (e) => {
    const t = (e.target as HTMLElement).closest<K3TextFieldElement>('k3-text-field');
    if (!t || t.dataset.j === undefined) return;
    const val = inputValue(e, t), i = Number(t.dataset.i), j = Number(t.dataset.j);
    if (isLin(EQ.type)) EQ.lin[EQ.type][i][j] = val;
    else EQ.poly[EQ.type][j] = val;
    solve();
  });
  $('eqSolve').addEventListener('click', () => solve(true));
  solve();
}
