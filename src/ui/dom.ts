/** Élément par id, typé ; lève une erreur claire s'il manque dans le HTML. */
export function $<K extends keyof HTMLElementTagNameMap>(id: string, tag: K): HTMLElementTagNameMap[K];
export function $<T extends HTMLElement = HTMLElement>(id: string): T;
export function $(id: string, _tag?: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Élément #${id} introuvable`);
  return el;
}

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Sélectionne le bouton de valeur `value` dans un k3-button-group. */
export function setGroup(group: HTMLElement, value: string | number): void {
  group.querySelectorAll('k3-button').forEach((b) => {
    b.selected = b.getAttribute('value') === String(value);
  });
}

/** Valeur choisie dans un k3-button-group (événement k3-change). */
export function groupValue(e: Event): string | null {
  const values = (e as CustomEvent<K3GroupDetail>).detail?.values;
  if (values?.length) return values[0];
  const target = e.currentTarget as HTMLElement | null;
  return target?.querySelector('k3-button[selected]')?.getAttribute('value') ?? null;
}

/** Remplit un k3-select avec des couples [valeur, libellé]. */
export function fillSelect(select: K3SelectElement, items: ReadonlyArray<readonly [string | number, string]>, value: string | number): void {
  select.innerHTML = items.map(([v, l]) => `<k3-menu-item value="${esc(v)}">${esc(l)}</k3-menu-item>`).join('');
  select.value = String(value);
}

/** Valeur saisie transmise par k3-input / k3-change, sinon celle du champ. */
export function inputValue(e: Event, field: { value: string }): string {
  return (e as CustomEvent<Partial<K3ValueDetail>>).detail?.value ?? field.value;
}

/** Premier élément du chemin de l'événement qui correspond au sélecteur (traverse le shadow DOM). */
export function fromPath<T extends Element = HTMLElement>(e: Event, selector: string): T | null {
  for (const n of e.composedPath()) if (n instanceof Element && n.matches(selector)) return n as T;
  return null;
}
