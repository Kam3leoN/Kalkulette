import { CalcError, exactForm, fmtNice, fmtReal, toFrac } from '../engine';
import { clean, cross, dot, norm, type Vector } from '../math/linalg';
import { on } from '../ui/bus';
import { $, esc, groupValue, inputValue } from '../ui/dom';
import { pushHistory } from '../ui/history';
import { evalReal, state } from '../ui/state';
import { bigValue, errorHtml, setResult } from './result';

type Name = 'A' | 'B';
type VecResult = Vector | number | { angle: number };

const VEC: { dim: 2 | 3; A: string[]; B: string[]; op: number } = { dim: 3, A: ['1', '2', '3'], B: ['4', '-1', '2'], op: 3 };
const AXES = ['x', 'y', 'z'];

function renderEditors(): void {
  const names: Name[] = ['A', 'B'];
  $('vecEditors').innerHTML = names
    .map((n) => `<div class="surface"><h3>Vecteur ${n}</h3><div class="vecin ${VEC.dim === 2 ? 'd2' : ''}">${Array.from({ length: VEC.dim }, (_, i) => `<k3-text-field id="v${n}${i}" data-v="${n}" data-i="${i}" variant="outlined" label="${AXES[i]}" no-form></k3-text-field>`).join('')}</div></div>`)
    .join('');
  for (const n of names) for (let i = 0; i < VEC.dim; i++) $(`v${n}${i}`, 'k3-text-field').value = VEC[n][i] ?? '';
}

const read = (n: Name): Vector => Array.from({ length: VEC.dim }, (_, i) => evalReal(VEC[n][i] ?? '', `${n}.${AXES[i]}`));

const OPS: ReadonlyArray<readonly [string, () => VecResult]> = [
  ['A + B', () => {
    const a = read('A'), b = read('B');
    return a.map((v, i) => v + b[i]);
  }],
  ['A − B', () => {
    const a = read('A'), b = read('B');
    return a.map((v, i) => v - b[i]);
  }],
  ['A · B', () => dot(read('A'), read('B'))],
  ['A × B', () => cross(read('A'), read('B'))],
  ['|A|', () => norm(read('A'))],
  ['|B|', () => norm(read('B'))],
  ['angle(A, B)', () => {
    const a = read('A'), b = read('B');
    const d = norm(a) * norm(b);
    if (!d) throw new CalcError('math', 'Angle indéfini avec un vecteur nul');
    const t = Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d)));
    return { angle: state.angle === 'deg' ? (t * 180) / Math.PI : t };
  }],
  ['A unitaire', () => {
    const a = read('A');
    const n = norm(a);
    if (!n) throw new CalcError('math', 'Le vecteur nul n’a pas de direction');
    return a.map((v) => v / n);
  }],
];

const angleUnit = (): string => (state.angle === 'deg' ? '°' : ' rad');

function describe(r: VecResult): string {
  if (Array.isArray(r)) return `[${r.map((v) => fmtNice(clean(v))).join(' ; ')}]`;
  if (typeof r === 'number') return fmtReal(clean(r));
  return fmtReal(clean(r.angle)) + angleUnit();
}

function render(): VecResult | undefined {
  const [label, fn] = OPS[VEC.op];
  const box = $('vecResult');
  document.querySelectorAll('#vecOps k3-button').forEach((b, k) => b.setAttribute('variant', k === VEC.op ? 'filled' : 'tonal'));
  try {
    const r = fn();
    let html: string;
    if (Array.isArray(r)) {
      const values = r.map((v) => clean(v));
      html = `<div class="bigval">[ ${values.map((v) => esc(fmtNice(v))).join(' ;  ')} ]</div>`;
      /* forme exacte (racines, π) quand une composante n'est pas une fraction simple */
      if (values.some((v) => exactForm(v) && !toFrac(v, 999))) {
        html += `<div class="exact exact-block">= [ ${values.map((v) => esc(exactForm(v) ?? fmtReal(v))).join(' ; ')} ]</div>`;
      }
    } else if (typeof r === 'number') html = bigValue(clean(r));
    else html = bigValue(clean(r.angle), angleUnit());
    setResult(box, `<div class="rt">${esc(label)}</div>${html}`);
    return r;
  } catch (e) {
    setResult(box, errorHtml(label, e), true);
    return undefined;
  }
}

export function initVector(): void {
  renderEditors();
  $('dimGroup').addEventListener('k3-change', (e) => {
    const v = Number(groupValue(e));
    if ((v === 2 || v === 3) && v !== VEC.dim) {
      VEC.dim = v;
      renderEditors();
      render();
    }
  });
  $('vecEditors').addEventListener('k3-input', (e) => {
    const t = (e.target as HTMLElement).closest<K3TextFieldElement>('k3-text-field');
    const name = t?.dataset.v as Name | undefined;
    if (!t || !name) return;
    VEC[name][Number(t.dataset.i)] = inputValue(e, t);
    render();
  });
  $('vecOps').innerHTML = OPS.map(([l], i) => `<k3-button variant="tonal" size="sm" data-op="${i}">${esc(l)}</k3-button>`).join('');
  $('vecOps').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-op]');
    if (!b) return;
    VEC.op = Number(b.dataset.op);
    const r = render();
    if (r === undefined) return;
    const a = VEC.A.slice(0, VEC.dim).join(' ; '), bb = VEC.B.slice(0, VEC.dim).join(' ; ');
    pushHistory({ mode: 'vector', tab: 'vector', tokens: [], expr: `${OPS[VEC.op][0]}, A = [${a}], B = [${bb}]`, result: describe(r) });
  });
  on('angle', () => render());
  render();
}
