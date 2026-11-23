import { emit } from './bus';
import { $ } from './dom';
import { SEEDS, save, state, type ThemeChoice } from './state';

const CYCLE: ThemeChoice[] = ['auto', 'light', 'dark'];
const META: Record<ThemeChoice, readonly [icon: string, label: string]> = {
  auto: ['contrast', 'Thème : automatique'],
  light: ['light_mode', 'Thème : clair'],
  dark: ['dark_mode', 'Thème : sombre'],
};

/** Clair/sombre : choix de l'utilisateur, sinon celui de l'hôte (data-theme), sinon le système. */
function resolvedMode(): 'light' | 'dark' | 'system' {
  if (state.theme !== 'auto') return state.theme;
  const host = document.documentElement.getAttribute('data-theme');
  return host === 'dark' || host === 'light' ? host : 'system';
}

/** Schéma M3 « Tonal Spot », spécification 2025, généré depuis la couleur source choisie. */
export async function applyTheme(): Promise<void> {
  try {
    await window.K3UI?.init({ theme: { seed: state.seed, mode: resolvedMode(), variant: 'tonalspot', specVersion: '2025' } });
  } catch {
    /* thème par défaut de K3ui */
  }
  const [icon, label] = META[state.theme];
  const iconEl = $('themeIcon');
  /* une seule source pour la ligature : l'attribut lu par K3ui (texte vide, sinon deux glyphes se superposent) */
  iconEl.textContent = '';
  iconEl.setAttribute('data-k3-icon', icon);
  const btn = $('themeBtn', 'k3-icon-button');
  btn.label = label;
  btn.title = label;
  document.querySelectorAll<HTMLButtonElement>('#seeds .seed').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seed === state.seed)));
  requestAnimationFrame(() => emit('themeApplied'));
}

export function initTheme(): void {
  const seeds = $('seeds');
  seeds.innerHTML = SEEDS.map(([c, n]) => `<button type="button" class="seed" style="--c:${c}" data-seed="${c}" aria-label="Couleur ${n}" title="${n}" aria-pressed="false"></button>`).join('');
  seeds.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.seed');
    if (!b?.dataset.seed) return;
    state.seed = b.dataset.seed;
    save();
    void applyTheme();
  });
  $('themeBtn').addEventListener('click', () => {
    state.theme = CYCLE[(CYCLE.indexOf(state.theme) + 1) % CYCLE.length];
    save();
    void applyTheme();
  });
  new MutationObserver(() => {
    if (state.theme === 'auto') void applyTheme();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(() => emit('themeApplied')));
  void applyTheme();
}
