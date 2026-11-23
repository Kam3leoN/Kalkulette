import { CalcError, exactForm, fmtReal } from '../engine';
import { esc } from '../ui/dom';

/** Affiche un résultat dans une carte ; `isError` passe la carte aux couleurs d'erreur. */
export function setResult(box: HTMLElement, html: string, isError = false): void {
  box.classList.toggle('is-err', isError);
  box.innerHTML = html;
}

export const errorText = (e: unknown): string => (e instanceof CalcError ? e.message : 'Erreur inattendue');

export function errorHtml(title: string, e: unknown): string {
  return `<div class="rt">${esc(title)}</div><div class="err-text">${esc(errorText(e))}</div>`;
}

/** Grand nombre avec sa forme exacte éventuelle. */
export function bigValue(v: number, suffix = ''): string {
  const ex = suffix ? null : exactForm(v);
  return `<div class="bigval">${esc(fmtReal(v))}${esc(suffix)}${ex ? `<span class="exact">${esc(ex)}</span>` : ''}</div>`;
}
