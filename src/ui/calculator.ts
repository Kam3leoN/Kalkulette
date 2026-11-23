import {
  C, CalcError, VAR_NAMES, exactForm, fmtComplex, fmtPolar, fmtReal, makeRealFn, parse, runAst, variablesIn,
  type Angle, type Complex, type Mode, type VarName,
} from '../engine';
import { solveReal } from '../math/solve';
import { emit, on } from './bus';
import { $, esc, fillSelect, fromPath, groupValue, inputValue, setGroup } from './dom';
import { pushHistory } from './history';
import { MODE_LABEL, evalReal, opts, save, state } from './state';

/* ---------- Définition des touches ---------- */
type KeyAction = 'shift' | 'hyp' | 'left' | 'right' | 'sd' | 'del' | 'ac' | 'eq' | 'dyn';
interface KeyDef {
  /** action spéciale */
  k?: KeyAction;
  /** texte inséré */
  i?: string;
  /** texte inséré avec SHIFT */
  si?: string;
  /** variable (SHIFT : STO) */
  v?: VarName;
  /** touche trigonométrique (sensible à hyp) */
  trig?: 'sin' | 'cos' | 'tan';
  /** libellé, libellé SHIFT, classes, info-bulle, forme */
  l?: string;
  sl?: string;
  c?: string;
  t?: string;
  shape?: 'round' | 'square';
}
type ResolvedKey = KeyDef & { l: string };

const FN_ROWS: KeyDef[][] = [
  [
    { k: 'shift', l: 'SHIFT', c: 'k-toggle', t: 'Fonctions secondaires (au-dessus des touches)' },
    { k: 'hyp', l: 'hyp', c: 'k-toggle', t: 'Fonctions hyperboliques' },
    { k: 'left', l: '◀', t: 'Curseur à gauche' },
    { k: 'right', l: '▶', t: 'Curseur à droite' },
    { k: 'sd', l: 'S⇔D', t: 'Basculer entre forme décimale et forme exacte' },
    { i: 'Ran#', l: 'Ran#', si: 'RanInt(', sl: 'RanInt', t: 'Nombre aléatoire' },
  ],
  [
    { i: '²', l: 'x²', si: '³', sl: 'x³' },
    { i: '^(', l: 'xʸ', si: 'ˣ√(', sl: 'ˣ√' },
    { i: '√(', l: '√', si: '∛(', sl: '∛' },
    { i: '⁻¹', l: 'x⁻¹', si: '!', sl: 'x!' },
    { i: 'log(', l: 'log', si: '10^(', sl: '10ˣ' },
    { i: 'ln(', l: 'ln', si: 'e^(', sl: 'eˣ' },
  ],
  [{ trig: 'sin' }, { trig: 'cos' }, { trig: 'tan' }, { i: '(', l: '(' }, { i: ')', l: ')' }, { i: 'π', l: 'π', si: 'e', sl: 'e' }],
  [
    { i: 'nCr(', l: 'nCr', si: 'nPr(', sl: 'nPr', t: 'Combinaisons nCr(n, r)' },
    { i: 'Abs(', l: '|x|', si: '%', sl: '%' },
    { i: ',', l: ',', t: 'Séparateur d’arguments' },
    { i: '∫(', l: '∫dx', si: 'd/dx(', sl: 'd/dx', t: '∫(f(X), a, b)' },
    { i: 'Σ(', l: 'Σ', si: 'mod(', sl: 'mod', t: 'Σ(f(X), début, fin)' },
    { k: 'dyn' },
  ],
  VAR_NAMES.map((v) => ({ v, l: v, sl: 'STO', c: 'k-var', t: `Variable ${v} (SHIFT : enregistrer le résultat dans ${v})` })),
];
const MAIN_ROWS: Array<Array<KeyDef | string>> = [
  ['7', '8', '9', { k: 'del', l: 'DEL', c: 'k-clr', t: 'Effacer un élément' }, { k: 'ac', l: 'AC', c: 'k-clr', t: 'Tout effacer' }],
  ['4', '5', '6', { i: '×', l: '×', c: 'k-op' }, { i: '÷', l: '÷', c: 'k-op' }],
  ['1', '2', '3', { i: '+', l: '+', c: 'k-op' }, { i: '−', l: '−', c: 'k-op' }],
  ['0', { i: '.', l: '.', c: 'k-num' }, { i: 'ᴇ', l: '×10ˣ', c: 'k-op small', t: 'Exposant de 10' }, { i: 'Ans', l: 'Ans', c: 'k-op small', t: 'Dernier résultat' }, { k: 'eq', l: '=', c: 'k-eq', t: 'Calculer', shape: 'square' }],
];

/** Touche dont le rôle dépend du mode. */
function dynKey(): ResolvedKey {
  if (state.mode === 'cmplx') return { i: 'i', l: 'i', si: 'conj(', sl: 'conj', t: 'Unité imaginaire', c: 'k-fn' };
  if (state.mode === 'calc') return { i: '=', l: '=', sl: 'équation', t: 'Signe égal d’une équation (pour SOLVE)', c: 'k-fn' };
  return { i: 'round(', l: 'Rnd', si: 'Int(', sl: 'Int', t: 'Arrondi', c: 'k-fn' };
}

function resolveKey(def: KeyDef | string): ResolvedKey {
  if (typeof def === 'string') return { i: def, l: def, c: 'k-num' };
  if (def.k === 'dyn') return dynKey();
  if (def.trig) {
    const base = def.trig + (state.hyp ? 'h' : '');
    return { ...def, i: base + '(', l: base, si: base + '⁻¹(', sl: base + '⁻¹', c: 'k-fn' };
  }
  return { ...def, l: def.l ?? '', c: def.c ?? 'k-fn' };
}

const keyIndex: ResolvedKey[] = [];

function renderKeys(): void {
  keyIndex.length = 0;
  const build = (rows: Array<Array<KeyDef | string>>, el: HTMLElement, size: 'fn' | 'main'): void => {
    el.innerHTML = rows
      .flat()
      .map((def) => {
        const d = resolveKey(def);
        const idx = keyIndex.push(d) - 1;
        const title = d.t ?? (d.sl ? `${d.l} · SHIFT : ${d.sl}` : d.l);
        const sel = (d.k === 'shift' && state.shift) || (d.k === 'hyp' && state.hyp) ? ' selected' : '';
        const alt = size === 'fn' ? `<span class="alt" aria-hidden="true">${esc(d.sl ?? '')}</span>` : '';
        return `<div class="cell${d.sl ? ' has-alt' : ''}">${alt}<k3-button class="key ${d.c ?? ''}" size="${size === 'fn' ? 'sm' : 'md'}" shape="${d.shape ?? 'round'}" variant="tonal" data-idx="${idx}" title="${esc(title)}" aria-label="${esc(d.t ?? d.l)}"${sel}>${esc(d.l)}</k3-button></div>`;
      })
      .join('');
  };
  build(FN_ROWS, $('fnKeys'), 'fn');
  build(MAIN_ROWS, $('mainKeys'), 'main');
  updateKeyStates();
}

function updateKeyStates(): void {
  $('calc').classList.toggle('shift', state.shift);
  document.querySelectorAll<K3ButtonElement>('#fnKeys .k-toggle').forEach((b) => {
    const d = keyIndex[Number(b.dataset.idx)];
    b.selected = d.k === 'shift' ? state.shift : state.hyp;
  });
}

/** Au clavier physique, la touche correspondante se déforme comme sous le doigt. */
function flashKey(d: KeyDef): void {
  const idx = keyIndex.findIndex((k) => (d.k && k.k === d.k) || (d.i !== undefined && k.i === d.i) || (d.v && k.v === d.v));
  if (idx < 0) return;
  const b = document.querySelector<HTMLElement & { _flash?: number }>(`.key[data-idx="${idx}"]`);
  if (!b) return;
  b.setAttribute('data-pressed', '');
  window.clearTimeout(b._flash);
  b._flash = window.setTimeout(() => b.removeAttribute('data-pressed'), 140);
}

/* ---------- Édition ---------- */
const AFTER_ANS = new Set(['+', '−', '×', '÷', '^(', '^', '²', '³', '⁻¹', '!', '%']);

function insert(tok: string): void {
  if (state.evaluated) {
    /* comme sur une calculatrice : un opérateur après « = » continue avec Ans */
    state.tokens = AFTER_ANS.has(tok) ? ['Ans'] : [];
    state.cursor = state.tokens.length;
    state.evaluated = false;
    state.result = null;
  }
  state.tokens.splice(state.cursor, 0, tok);
  state.cursor++;
}

export function press(d: KeyDef): void {
  if (d.k === 'shift') {
    state.shift = !state.shift;
    updateKeyStates();
    renderLCD();
    return;
  }
  if (d.k === 'hyp') {
    state.hyp = !state.hyp;
    renderKeys();
    renderLCD();
    return;
  }
  const sh = state.shift;
  state.shift = false;
  state.note = null;
  let hypUsed = false;
  let pop = false;
  if (state.error && d.k !== 'eq') state.error = null;
  switch (d.k) {
    case 'left':
      if (state.evaluated) {
        state.evaluated = false;
        state.cursor = state.tokens.length;
      } else state.cursor = state.cursor > 0 ? state.cursor - 1 : state.tokens.length;
      break;
    case 'right':
      if (state.evaluated) {
        state.evaluated = false;
        state.cursor = 0;
      } else state.cursor = state.cursor < state.tokens.length ? state.cursor + 1 : 0;
      break;
    case 'del':
      if (state.evaluated) {
        state.evaluated = false;
        state.cursor = state.tokens.length;
      } else if (state.cursor > 0) {
        state.tokens.splice(state.cursor - 1, 1);
        state.cursor--;
      }
      break;
    case 'ac':
      Object.assign(state, { tokens: [], cursor: 0, evaluated: false, result: null, error: null });
      break;
    case 'eq':
      doEquals();
      pop = true;
      break;
    case 'sd':
      if (state.result && state.resultForms.length > 1) {
        state.view = (state.view + 1) % state.resultForms.length;
        pop = true;
      }
      break;
    default:
      if (d.v) {
        if (sh) {
          state.vars[d.v] = state.ans;
          state.note = `Ans → ${d.v}`;
          save();
          emit('memories');
        } else insert(d.v);
      } else if (d.i !== undefined) {
        insert(sh && d.si ? d.si : d.i);
        if (d.trig && state.hyp) {
          state.hyp = false;
          hypUsed = true;
        }
      }
  }
  if (hypUsed) renderKeys();
  else updateKeyStates();
  renderLCD(pop);
  if (state.mode === 'calc') renderCalcPanel();
}

/* ---------- Calcul et affichage ---------- */
function resultFormsFor(z: Complex): string[] {
  const forms = [fmtComplex(z)];
  if (z.im === 0) {
    const ex = exactForm(z.re);
    if (ex) forms.push(ex);
  } else if (state.mode === 'cmplx') forms.push(fmtPolar(z, state.angle));
  return forms;
}

function showResult(z: Complex, label: string | null = null): void {
  Object.assign(state, { ans: z, result: z, error: null, view: 0, evaluated: true, resultForms: resultFormsFor(z), note: label });
}

const message = (e: unknown): string => (e instanceof CalcError ? e.message : 'Erreur');

function doEquals(): void {
  if (!state.tokens.length) return;
  const src = state.tokens.join('');
  try {
    if (state.mode === 'calc') readCalcVars();
    const ast = parse(src);
    const z = runAst(ast, opts());
    showResult(z, ast.t === 'eq' ? 'Gauche − Droite' : null);
    pushHistory({ mode: state.mode, expr: src, result: fmtComplex(z) });
    emit('memories');
  } catch (e) {
    Object.assign(state, { error: message(e), result: null, evaluated: false });
  }
}

export function renderLCD(pop = false): void {
  const pill = (id: string, on: boolean): void => {
    $(id).classList.toggle('on', on);
    $(id).classList.toggle('ghost', !on);
  };
  pill('pS', state.shift);
  pill('pH', state.hyp);
  $('pM').textContent = MODE_LABEL[state.mode];
  $('pA').textContent = state.angle === 'deg' ? 'DEG' : 'RAD';

  const ex = $('expr');
  if (state.evaluated) ex.innerHTML = esc(state.tokens.join(''));
  else {
    const before = esc(state.tokens.slice(0, state.cursor).join(''));
    const after = esc(state.tokens.slice(state.cursor).join(''));
    ex.innerHTML = `${before}<span class="caret" id="caret"></span>${after}`;
    const caret = document.getElementById('caret');
    if (caret) {
      const l = caret.offsetLeft;
      if (l < ex.scrollLeft || l > ex.scrollLeft + ex.clientWidth - 8) ex.scrollLeft = Math.max(0, l - ex.clientWidth + 24);
    }
  }

  const res = $('res'), sub = $('sub');
  $('display').classList.toggle('err', !!state.error);
  if (state.error) {
    res.innerHTML = `<span class="msg">${esc(state.error)}</span>`;
    sub.textContent = 'Corrigez l’expression puis =, ou AC pour effacer';
    return;
  }
  if (state.result && state.evaluated) {
    res.textContent = state.resultForms[state.view];
    const others = state.resultForms.filter((_, i) => i !== state.view);
    sub.textContent = [state.note, others.length ? '= ' + others.join(' = ') : ''].filter(Boolean).join('   ');
    res.scrollLeft = res.scrollWidth;
    if (pop) {
      res.classList.remove('pop');
      void res.offsetWidth;
      res.classList.add('pop');
    }
  } else {
    res.textContent = '';
    sub.textContent = state.note ?? '';
  }
}

/* ---------- Mode CALC ---------- */
function renderCalcPanel(): void {
  const panel = $('calcPanel');
  panel.hidden = state.mode !== 'calc';
  if (panel.hidden) return;
  const vs = variablesIn(state.tokens.join(''));
  const box = $('cvars');
  const existing = [...box.querySelectorAll<K3TextFieldElement>('k3-text-field')].map((f) => f.dataset.v).join(',');
  if (existing !== vs.join(',')) {
    box.innerHTML = vs.length
      ? vs.map((v) => `<k3-text-field id="cv-${v}" data-v="${v}" variant="outlined" label="${v} =" no-form></k3-text-field>`).join('')
      : '<span class="cvars-empty">Aucune variable dans l’expression pour l’instant.</span>';
    box.querySelectorAll<K3TextFieldElement>('k3-text-field').forEach((f) => {
      const v = f.dataset.v as VarName;
      f.value = state.calcInputs[v] ?? String(+state.vars[v].re.toPrecision(12));
      f.addEventListener('k3-input', (e) => {
        state.calcInputs[v] = inputValue(e, f);
      });
    });
  }
  const sel = $('solveVar', 'k3-select');
  const list: VarName[] = vs.length ? vs : ['X'];
  const current = sel.value as VarName;
  const shown = [...sel.querySelectorAll('k3-menu-item')].map((o) => o.getAttribute('value')).join(',');
  if (shown !== list.join(',')) {
    fillSelect(sel, list.map((v) => [v, v] as const), list.includes(current) ? current : list.includes('X') ? 'X' : list[0]);
  }
}

function readCalcVars(): void {
  for (const f of $('cvars').querySelectorAll<K3TextFieldElement>('k3-text-field')) {
    const v = f.dataset.v as VarName;
    state.vars[v] = C(evalReal(f.value, v));
  }
}

function doSolve(): void {
  if (!state.tokens.length) {
    state.error = 'Saisissez d’abord une équation';
    renderLCD();
    return;
  }
  const src = state.tokens.join('');
  const v = ($('solveVar', 'k3-select').value || 'X') as VarName;
  try {
    readCalcVars();
    const f = makeRealFn(parse(src), opts(), v);
    const x = solveReal(f, state.vars[v].re);
    const cleaned = Math.abs(x) < 1e-12 ? 0 : x;
    const rounded = Number(cleaned.toPrecision(12));
    const best = Math.abs(f(rounded)) <= Math.abs(f(cleaned)) ? rounded : cleaned;
    state.vars[v] = C(best);
    state.calcInputs[v] = String(best);
    showResult(C(best), `SOLVE ${v} · G−D = ${fmtReal(f(best), 3)}`);
    const exact = exactForm(best);
    state.resultForms = [`${v} = ${fmtReal(best)}`, ...(exact ? [`${v} = ${exact}`] : [])];
    pushHistory({ mode: 'calc', expr: `SOLVE ${v} : ${src}`, tokens: [...state.tokens], result: `${v} = ${fmtReal(best)}` });
    const field = document.getElementById(`cv-${v}`) as K3TextFieldElement | null;
    if (field) field.value = String(best);
    emit('memories');
    save();
  } catch (e) {
    state.error = message(e);
  }
  renderLCD(true);
}

/* ---------- Mode et unité d'angle ---------- */
export function setMode(m: Mode): void {
  state.mode = m;
  setGroup($('modeGroup'), m);
  if (state.result) {
    state.resultForms = resultFormsFor(state.result);
    state.view = 0;
  }
  renderKeys();
  renderLCD();
  renderCalcPanel();
  save();
}

export function setAngle(a: Angle): void {
  state.angle = a;
  setGroup($('angleGroup'), a);
  if (state.result) state.resultForms = resultFormsFor(state.result);
  renderLCD();
  save();
  emit('angle', a);
}

/** Recharge une expression de l'historique. */
function reuse(tokens: string[], mode: Mode): void {
  if (mode !== state.mode) setMode(mode);
  Object.assign(state, { tokens: [...tokens], cursor: tokens.length, evaluated: false, result: null, error: null });
  renderLCD();
  renderCalcPanel();
  if (window.matchMedia('(max-width: 1000px)').matches) $('calc').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Clavier physique ---------- */
function onKeydown(e: KeyboardEvent): void {
  const path = e.composedPath();
  const inField = path.some((n) => n instanceof Element && (n.matches('input, textarea, select, [contenteditable="true"]') || /^K3-(TEXT-FIELD|SELECT)$/.test(n.tagName)));
  if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  const onButton = path.some((n) => n instanceof Element && /^(BUTTON|K3-BUTTON|K3-ICON-BUTTON|K3-CHIP|K3-NAV-ITEM)$/.test(n.tagName));
  if (onButton && (k === 'Enter' || k === ' ')) return;
  if (document.querySelector('k3-dialog[open], k3-sheet[open]')) return;
  const map: Record<string, string> = { '*': '×', '/': '÷', '-': '−' };
  let d: KeyDef | null = null;
  if (k === 'Enter' || (k === '=' && state.mode !== 'calc')) d = { k: 'eq' };
  else if (k === 'Backspace') d = { k: 'del' };
  else if (k === 'Escape' || k === 'Delete') d = { k: 'ac' };
  else if (k === 'ArrowLeft') d = { k: 'left' };
  else if (k === 'ArrowRight') d = { k: 'right' };
  else if (/^[0-9.+\-*/^()!,%=]$/.test(k)) d = { i: map[k] ?? k };
  else if (/^[a-zA-Zπ]$/.test(k)) d = { i: k };
  if (!d) return;
  e.preventDefault();
  flashKey(d);
  press(d);
}

export function initCalculator(firstVisit: boolean): void {
  renderKeys();
  document.querySelectorAll('.keys').forEach((pad) =>
    pad.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.key');
      if (b) press(keyIndex[Number(b.dataset.idx)]);
    }),
  );
  /* garder le focus hors des touches : Entrée calcule au lieu de « recliquer » la dernière touche */
  document.addEventListener('mousedown', (e) => {
    if (fromPath(e, 'k3-text-field, k3-select')) return;
    if (fromPath(e, '#calc, #angleGroup')) e.preventDefault();
  });
  $('modeGroup').addEventListener('k3-change', (e) => {
    const v = groupValue(e);
    if ((v === 'comp' || v === 'cmplx' || v === 'calc') && v !== state.mode) setMode(v);
  });
  $('angleGroup').addEventListener('k3-change', (e) => {
    const v = groupValue(e);
    if ((v === 'deg' || v === 'rad') && v !== state.angle) setAngle(v);
  });
  $('btnCalc').addEventListener('click', () => {
    doEquals();
    renderLCD(true);
  });
  $('btnSolve').addEventListener('click', doSolve);
  document.addEventListener('keydown', onKeydown);
  on('reuse', (h) => {
    if (h.mode === 'comp' || h.mode === 'cmplx' || h.mode === 'calc') reuse(h.tokens.length ? h.tokens : [h.expr], h.mode);
  });

  setGroup($('angleGroup'), state.angle);
  setMode(state.mode);
  if (firstVisit) {
    /* un exemple réel déjà calculé à l'ouverture */
    state.tokens = ['√(', '2', ')', '×', 'π', '÷', '4'];
    state.cursor = state.tokens.length;
    doEquals();
  }
  renderLCD();
}
