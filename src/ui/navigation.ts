import { emit, on } from './bus';
import { $, fromPath } from './dom';
import { TABS, TAB_LABELS, save, state, type TabName } from './state';

/** Sous 600 px : les outils s'ouvrent dans une feuille du bas, les onglets deviennent une barre de navigation. */
const mobile = window.matchMedia('(max-width: 599.98px)');
const isMobile = (): boolean => mobile.matches;

/* Les panneaux vivent dans la feuille sur mobile, dans l'espace de travail sinon (on déplace le nœud : l'état est conservé). */
function placePanes(): void {
  const panes = $('panes'), sheet = $('sheet', 'k3-sheet');
  if (isMobile()) {
    if (panes.parentElement !== sheet) sheet.appendChild(panes);
  } else if (panes.parentElement === sheet) {
    if (sheet.open) void sheet.hide('api');
    $('tabs').after(panes);
    emit('tabShown', state.tab);
  }
}

export function selectTab(name: TabName, openSheet = false): void {
  state.tab = name;
  const idx = TABS.indexOf(name);
  const tabs = $('tabs', 'k3-tabs');
  if (tabs.index !== idx) tabs.index = idx;
  const nav = $('navBar', 'k3-nav-bar');
  if (nav.active !== idx) nav.active = idx;
  $('sheetTitle').textContent = TAB_LABELS[name];
  for (const t of TABS) $(`pane-${t}`).hidden = t !== name;
  const sheet = $('sheet', 'k3-sheet');
  if (openSheet && isMobile() && !sheet.open) void sheet.show();
  emit('tabShown', name);
  save();
}

export function initNavigation(): void {
  $('tabs').addEventListener('k3-change', (e) => {
    const i = (e as CustomEvent<K3IndexDetail>).detail?.index;
    if (typeof i === 'number' && TABS[i]) selectTab(TABS[i]);
  });
  /* un appui sur la barre ouvre la feuille, même sur la destination déjà active */
  $('navBar').addEventListener('click', (e) => {
    const item = fromPath(e, 'k3-nav-item');
    if (!item) return;
    const idx = [...$('navBar').querySelectorAll('k3-nav-item')].indexOf(item);
    if (idx >= 0) selectTab(TABS[idx], true);
  });
  const sheet = $('sheet', 'k3-sheet');
  sheet.addEventListener('k3-open-end', () => emit('tabShown', state.tab));
  /* dans la feuille, glisser sert à la fermer : on le réserve à la poignée et au fond, pas au graphe ni aux listes */
  for (const id of ['plot', 'hist', 'uTable']) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());

  on('reuse', (h) => {
    if (h.tab) selectTab(h.tab, true);
    else if (isMobile() && sheet.open) void sheet.hide('api');
  });

  placePanes();
  mobile.addEventListener('change', placePanes);
  selectTab(state.tab);
}
