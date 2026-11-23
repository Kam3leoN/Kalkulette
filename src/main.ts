import './styles/main.scss';
/* ordre important : les options K3ui avant le paquet K3ui */
import './k3ui-config';
import './vendor/k3ui/k3ui.kalkulette.js';

import { initEquations } from './tools/equations';
import { initGraph } from './tools/graph';
import { initMatrix } from './tools/matrix';
import { initUnits } from './tools/units';
import { initVector } from './tools/vector';
import { initCalculator } from './ui/calculator';
import { initHistory } from './ui/history';
import { initLegal } from './ui/legal';
import { initNavigation } from './ui/navigation';
import { load } from './ui/state';
import { initTheme } from './ui/theme';

const REQUIRED = ['k3-button', 'k3-button-group', 'k3-tabs', 'k3-text-field', 'k3-select', 'k3-chip-set', 'k3-sheet', 'k3-nav-bar', 'k3-dialog'];

async function start(): Promise<void> {
  const returning = load();
  /* attendre la définition des composants (au plus 4 s, l'interface reste utilisable sinon) */
  await Promise.race([Promise.all(REQUIRED.map((t) => customElements.whenDefined(t))), new Promise((r) => setTimeout(r, 4000))]);
  initTheme();
  initHistory();
  initCalculator(!returning);
  initGraph();
  initMatrix();
  initVector();
  initEquations();
  initUnits();
  initNavigation();
  initLegal();
}

void start();
