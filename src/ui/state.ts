import { C, CalcError, VAR_NAMES, parse, runAst, type Angle, type Complex, type EvalOptions, type Mode, type VarName } from '../engine';

export const TABS = ['graph', 'matrix', 'vector', 'eqn', 'units', 'history'] as const;
export type TabName = (typeof TABS)[number];
export const TAB_LABELS: Record<TabName, string> = {
  graph: 'Graphe', matrix: 'Matrices', vector: 'Vecteurs', eqn: 'Équations', units: 'Unités', history: 'Historique',
};
export const MODE_LABEL: Record<Mode, string> = { comp: 'COMP', cmplx: 'CMPLX', calc: 'CALC' };
export const SEEDS: ReadonlyArray<readonly [string, string]> = [
  ['#00687A', 'Sarcelle'], ['#3A5BA9', 'Indigo'], ['#7A4E9E', 'Violet'], ['#A0453B', 'Brique'], ['#4C6B1F', 'Olive'],
];
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface HistoryEntry {
  mode: Mode | 'matrix' | 'vector' | 'eqn';
  expr: string;
  result: string;
  tokens: string[];
  tab?: TabName;
}

export interface AppState {
  mode: Mode;
  angle: Angle;
  tokens: string[];
  cursor: number;
  evaluated: boolean;
  shift: boolean;
  hyp: boolean;
  ans: Complex;
  vars: Record<VarName, Complex>;
  result: Complex | null;
  resultForms: string[];
  view: number;
  error: string | null;
  note: string | null;
  history: HistoryEntry[];
  tab: TabName;
  calcInputs: Partial<Record<VarName, string>>;
  seed: string;
  theme: ThemeChoice;
}

export const state: AppState = {
  mode: 'comp', angle: 'deg', tokens: [], cursor: 0, evaluated: false, shift: false, hyp: false,
  ans: C(0), vars: Object.fromEntries(VAR_NAMES.map((v) => [v, C(0)])) as Record<VarName, Complex>,
  result: null, resultForms: [], view: 0, error: null, note: null, history: [], tab: 'graph',
  calcInputs: {}, seed: SEEDS[0][0], theme: 'auto',
};

const STORE = 'kalkulette.v1';
const OLD_STORES = ['abaque.k3.v1'];
type Persisted = Pick<AppState, 'angle' | 'mode' | 'vars' | 'ans' | 'history' | 'tab' | 'seed' | 'theme'>;

export function save(): void {
  const data: Persisted = {
    angle: state.angle, mode: state.mode, vars: state.vars, ans: state.ans,
    history: state.history.slice(0, 100), tab: state.tab, seed: state.seed, theme: state.theme,
  };
  try {
    localStorage.setItem(STORE, JSON.stringify(data));
  } catch {
    /* stockage indisponible : l'application marche sans */
  }
}

/** Recharge l'état enregistré ; renvoie false à la première visite. */
export function load(): boolean {
  try {
    const raw = [STORE, ...OLD_STORES].map((k) => localStorage.getItem(k)).find(Boolean);
    if (!raw) return false;
    const d = JSON.parse(raw) as Partial<Persisted>;
    if (d.angle === 'deg' || d.angle === 'rad') state.angle = d.angle;
    if (d.mode === 'comp' || d.mode === 'cmplx' || d.mode === 'calc') state.mode = d.mode;
    if (d.ans) state.ans = d.ans;
    if (d.tab && (TABS as readonly string[]).includes(d.tab)) state.tab = d.tab;
    if (d.seed) state.seed = d.seed;
    if (d.theme === 'auto' || d.theme === 'light' || d.theme === 'dark') state.theme = d.theme;
    if (d.vars) for (const v of VAR_NAMES) if (d.vars[v]) state.vars[v] = d.vars[v];
    if (Array.isArray(d.history)) state.history = d.history;
    return true;
  } catch {
    return false;
  }
}

/** Options d'évaluation courantes. */
export const opts = (extra: Partial<EvalOptions> = {}): EvalOptions => ({
  mode: state.mode, angle: state.angle, vars: state.vars, ans: state.ans, ...extra,
});

/** Évalue une saisie de champ en réel (case vide = 0) ; préfixe le message d'erreur par `label`. */
export function evalReal(str: string | undefined, label?: string): number {
  const s = String(str ?? '').trim();
  if (s === '') return 0;
  try {
    return runAst(parse(s), opts({ mode: 'comp' })).re;
  } catch (e) {
    const err = e instanceof CalcError ? e : new CalcError('syntax', 'Erreur');
    throw new CalcError(err.kind, (label ? label + ' : ' : '') + err.message);
  }
}
