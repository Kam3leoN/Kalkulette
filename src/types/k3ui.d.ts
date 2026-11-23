/* Types minimaux des éléments K3ui utilisés par Kalkulette (propriétés et méthodes réellement appelées). */

export interface K3ThemeOptions {
  seed?: string;
  mode?: 'light' | 'dark' | 'system' | 'auto';
  variant?: 'tonalspot' | 'expressive' | 'vibrant' | 'neutral' | 'fidelity' | 'content' | 'monochrome' | 'rainbow' | 'fruitsalad';
  specVersion?: '2021' | '2025';
  motion?: 'expressive' | 'standard';
  contrast?: 'default' | 'medium' | 'high' | 'auto';
}

export interface K3InitOptions {
  locale?: string;
  theme?: K3ThemeOptions;
  interaction?: { ripple?: boolean };
  haptic?: boolean;
}

export interface K3UIApi {
  init(options?: K3InitOptions): Promise<unknown>;
}

declare global {
  interface Window {
    K3UI?: K3UIApi;
    K3UI_OPTIONS?: K3InitOptions;
  }

  interface K3ButtonElement extends HTMLElement {
    selected: boolean;
    disabled: boolean;
  }
  interface K3IconButtonElement extends HTMLElement {
    label: string;
    selected: boolean;
  }
  interface K3TextFieldElement extends HTMLElement {
    value: string;
    label: string;
    error: string;
  }
  interface K3SelectElement extends HTMLElement {
    value: string;
  }
  interface K3TabsElement extends HTMLElement {
    index: number;
  }
  interface K3NavBarElement extends HTMLElement {
    active: number;
  }
  interface K3SwitchElement extends HTMLElement {
    selected: boolean;
  }
  interface K3ChipElement extends HTMLElement {
    selected: boolean;
    value: string;
  }
  interface K3OverlayElement extends HTMLElement {
    open: boolean;
    show(): Promise<boolean>;
    hide(source?: 'user' | 'api' | 'escape' | 'backdrop'): Promise<boolean>;
  }
  interface K3SheetElement extends K3OverlayElement {}
  interface K3DialogElement extends K3OverlayElement {
    closeAction: boolean;
  }

  interface HTMLElementTagNameMap {
    'k3-button': K3ButtonElement;
    'k3-icon-button': K3IconButtonElement;
    'k3-text-field': K3TextFieldElement;
    'k3-select': K3SelectElement;
    'k3-tabs': K3TabsElement;
    'k3-nav-bar': K3NavBarElement;
    'k3-nav-item': HTMLElement;
    'k3-switch': K3SwitchElement;
    'k3-chip': K3ChipElement;
    'k3-chip-set': HTMLElement;
    'k3-button-group': HTMLElement;
    'k3-sheet': K3SheetElement;
    'k3-dialog': K3DialogElement;
  }

  /** Détails des événements K3ui écoutés. */
  interface K3ValueDetail {
    value: string;
  }
  interface K3IndexDetail {
    index: number;
  }
  interface K3SelectedDetail {
    selected: boolean;
  }
  interface K3GroupDetail {
    values?: string[];
  }
  interface K3ChipSetDetail {
    chip?: K3ChipElement;
    values?: string[];
  }
}
