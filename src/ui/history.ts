import { VAR_NAMES, fmtComplex } from '../engine';
import { emit, on } from './bus';
import { $, esc } from './dom';
import { save, state, type HistoryEntry } from './state';

export function pushHistory(entry: Omit<HistoryEntry, 'tokens'> & { tokens?: string[] }): void {
  state.history.unshift({ ...entry, tokens: entry.tokens ?? [...state.tokens] });
  state.history = state.history.slice(0, 100);
  save();
  renderHistory();
}

export function renderHistory(): void {
  const ul = $('hist');
  if (!state.history.length) {
    ul.innerHTML = '<li class="empty">Aucun calcul pour l’instant. Vos résultats apparaîtront ici.</li>';
    return;
  }
  ul.innerHTML = state.history
    .map((h, i) => `<li data-i="${i}" tabindex="0" role="button" title="Recharger"><span class="tag">${esc(h.mode.toUpperCase())}</span><span class="hx">${esc(h.expr)}</span><span class="hr">${esc(h.result)}</span></li>`)
    .join('');
}

export function renderMems(): void {
  const rows = [['Ans', state.ans], ...VAR_NAMES.map((v) => [v, state.vars[v]] as const)] as const;
  $('mems').innerHTML = rows.map(([k, z]) => `<div class="mem"><b>${k}</b><span>${esc(fmtComplex(z))}</span></div>`).join('');
}

export function initHistory(): void {
  const list = $('hist');
  const reuse = (target: EventTarget | null): void => {
    const li = (target as HTMLElement | null)?.closest<HTMLElement>('li[data-i]');
    const entry = li ? state.history[Number(li.dataset.i)] : undefined;
    if (entry) emit('reuse', entry);
  };
  list.addEventListener('click', (e) => reuse(e.target));
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      reuse(e.target);
    }
  });

  /* effacement en deux temps, sans boîte de confirmation du navigateur */
  const label = $('hClearLbl');
  let armed = false;
  let timer: number | undefined;
  $('hClear').addEventListener('click', () => {
    if (!armed) {
      armed = true;
      label.textContent = 'Confirmer l’effacement';
      timer = window.setTimeout(() => {
        armed = false;
        label.textContent = 'Effacer l’historique';
      }, 4000);
      return;
    }
    window.clearTimeout(timer);
    armed = false;
    label.textContent = 'Effacer l’historique';
    state.history = [];
    save();
    renderHistory();
  });

  on('memories', renderMems);
  renderHistory();
  renderMems();
}
