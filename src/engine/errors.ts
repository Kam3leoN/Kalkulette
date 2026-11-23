export type CalcErrorKind = 'syntax' | 'math';

/** Erreur de calcul affichée telle quelle à l'utilisateur (messages en français). */
export class CalcError extends Error {
  readonly kind: CalcErrorKind;
  constructor(kind: CalcErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'CalcError';
  }
}

export const synErr = (m = 'Erreur de syntaxe'): CalcError => new CalcError('syntax', m);
export const mathErr = (m = 'Erreur math'): CalcError => new CalcError('math', m);
