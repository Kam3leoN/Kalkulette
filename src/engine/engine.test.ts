import { describe, expect, it } from 'vitest';
import { C, VAR_NAMES, exactForm, fmtComplex, parse, runAst, type Angle, type Complex, type Mode, type VarName } from './index';

const vars = Object.fromEntries(VAR_NAMES.map((v) => [v, C(0)])) as Record<VarName, Complex>;
vars.A = C(2);
vars.X = C(3);

function calc(src: string, mode: Mode = 'comp', angle: Angle = 'deg'): string {
  try {
    return fmtComplex(runAst(parse(src), { mode, angle, vars, ans: C(5) }));
  } catch (e) {
    return 'ERR ' + (e as Error).message;
  }
}

describe('priorités et syntaxe', () => {
  it.each([
    ['1+2×3', '7'],
    ['-2^2', '−4'],
    ['2^3^2', '512'],
    ['2(3+4)', '14'],
    ['3²+4²', '25'],
    ['sin(30', '0.5'],
    ['((2)', '2'],
    ['1.5ᴇ3', '1500'],
    ['2X+A', '8'],
    ['Ans×2', '10'],
  ])('%s = %s', (src, expected) => expect(calc(src)).toBe(expected));

  it('multiplication implicite prioritaire sur la division', () => expect(calc('1÷2π')).toBe('0.1591549431'));
  it('signale les erreurs de syntaxe', () => {
    expect(calc('3+')).toBe('ERR Expression incomplète');
    expect(calc('2)')).toBe('ERR Parenthèse fermante en trop');
    expect(calc('X^2=4')).toBe('ERR Le signe = sert aux équations du mode CALC');
  });
});

describe('fonctions', () => {
  it.each([
    ['tan(90)', 'ERR Erreur math'],
    ['sin⁻¹(0.5)', '30'],
    ['5!', '120'],
    ['nCr(5,2)', '10'],
    ['log(2,8)', '3'],
    ['(-8)^(1/3)', '−2'],
    ['ˣ√(3,-27)', '−3'],
    ['1÷0', 'ERR Division par zéro'],
    ['∫(X^2,0,3)', '9'],
    ['d/dx(X^3,2)', '12'],
    ['Σ(X,1,100)', '5050'],
    ['mod(17,5)', '2'],
  ])('%s = %s', (src, expected) => expect(calc(src)).toBe(expected));

  it('radians', () => {
    expect(calc('sin(π)', 'comp', 'rad')).toBe('0');
    expect(calc('∫(sin(X),0,π)', 'comp', 'rad')).toBe('2');
  });
});

describe('complexes', () => {
  it('refuse les résultats complexes hors CMPLX', () => expect(calc('√(-4)')).toBe('ERR Résultat complexe : passez en CMPLX'));
  it.each([
    ['√(-4)', '2i'],
    ['(1+2i)(3-i)', '5 + 5i'],
    ['i^2', '−1'],
    ['Abs(3+4i)', '5'],
  ])('%s = %s', (src, expected) => expect(calc(src, 'cmplx')).toBe(expected));
  it("identité d'Euler", () => expect(calc('e^(iπ)', 'cmplx', 'rad')).toBe('−1'));
});

describe('formes exactes', () => {
  it.each([
    [1 / 3, '1/3'],
    [Math.SQRT2 / 2, '√2/2'],
    [Math.PI / 4, 'π/4'],
    [2, null],
  ])('%f → %s', (x, expected) => expect(exactForm(x)).toBe(expected));
});
