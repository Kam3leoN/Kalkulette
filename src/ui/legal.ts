import { $ } from './dom';

const LEGAL_KEY = 'kalkulette.legal.v1';

/** Avis de protection : affiché à la première visite, puis à la demande (bouton « Licence »). */
export function initLegal(): void {
  const dialog = $('legal', 'k3-dialog');
  dialog.closeAction = false;
  $('legalOk').addEventListener('click', () => {
    try {
      localStorage.setItem(LEGAL_KEY, new Date().toISOString());
    } catch {
      /* stockage indisponible : l'avis réapparaîtra à la prochaine visite */
    }
    void dialog.hide('user');
  });
  $('legalBtn').addEventListener('click', () => void dialog.show());

  let accepted = false;
  try {
    accepted = !!localStorage.getItem(LEGAL_KEY);
  } catch {
    accepted = false;
  }
  if (!accepted) window.setTimeout(() => void dialog.show(), 400);
}
