import type { K3InitOptions } from './types/k3ui';

/**
 * Options lues par K3ui à son initialisation automatique : schéma de couleurs M3 « Tonal Spot »
 * (spécification 2025) généré depuis une couleur source. Ce module doit être importé avant le paquet K3ui.
 */
export const K3UI_OPTIONS: K3InitOptions = {
  locale: 'fr-FR',
  theme: { seed: '#00687A', mode: 'system', variant: 'tonalspot', specVersion: '2025', motion: 'expressive', contrast: 'default' },
  interaction: { ripple: true },
  haptic: true,
};

window.K3UI_OPTIONS = K3UI_OPTIONS;
