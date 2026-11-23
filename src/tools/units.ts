import { CalcError, fmtReal } from '../engine';
import { $, esc, fillSelect, fromPath, inputValue } from '../ui/dom';
import { evalReal } from '../ui/state';

/** [symbole, nom, facteur vers l'unité de base] — la température est traitée à part. */
type Unit = readonly [symbol: string, name: string, factor: number];
type Category = 'length' | 'mass' | 'temp' | 'area' | 'volume' | 'speed' | 'time' | 'data' | 'energy' | 'power' | 'pressure' | 'angle';

const PI = Math.PI;
const UNITS: Record<Category, { name: string; units: readonly Unit[]; defaults: readonly [number, number] }> = {
  length: { name: 'Longueur', defaults: [1, 6], units: [['m', 'mètre', 1], ['km', 'kilomètre', 1e3], ['cm', 'centimètre', 1e-2], ['mm', 'millimètre', 1e-3], ['µm', 'micromètre', 1e-6], ['nm', 'nanomètre', 1e-9], ['mi', 'mile', 1609.344], ['yd', 'yard', 0.9144], ['ft', 'pied', 0.3048], ['in', 'pouce', 0.0254], ['M', 'mille marin', 1852], ['al', 'année-lumière', 9.4607304725808e15]] },
  mass: { name: 'Masse', defaults: [0, 4], units: [['kg', 'kilogramme', 1], ['g', 'gramme', 1e-3], ['mg', 'milligramme', 1e-6], ['t', 'tonne', 1e3], ['lb', 'livre', 0.45359237], ['oz', 'once', 0.028349523125], ['st', 'stone', 6.35029318], ['ct', 'carat', 2e-4]] },
  temp: { name: 'Température', defaults: [0, 1], units: [['°C', 'degré Celsius', 1], ['°F', 'degré Fahrenheit', 1], ['K', 'kelvin', 1]] },
  area: { name: 'Surface', defaults: [3, 7], units: [['m²', 'mètre carré', 1], ['km²', 'kilomètre carré', 1e6], ['cm²', 'centimètre carré', 1e-4], ['ha', 'hectare', 1e4], ['a', 'are', 100], ['ft²', 'pied carré', 0.09290304], ['in²', 'pouce carré', 0.00064516], ['ac', 'acre', 4046.8564224], ['mi²', 'mile carré', 2589988.110336]] },
  volume: { name: 'Volume', defaults: [1, 6], units: [['m³', 'mètre cube', 1], ['L', 'litre', 1e-3], ['dL', 'décilitre', 1e-4], ['cL', 'centilitre', 1e-5], ['mL', 'millilitre', 1e-6], ['gal', 'gallon US', 3.785411784e-3], ['gal UK', 'gallon impérial', 4.54609e-3], ['pt', 'pinte US', 4.73176473e-4], ['fl oz', 'once liquide US', 2.95735295625e-5], ['ft³', 'pied cube', 0.028316846592]] },
  speed: { name: 'Vitesse', defaults: [1, 2], units: [['m/s', 'mètre par seconde', 1], ['km/h', 'kilomètre par heure', 1 / 3.6], ['mph', 'mile par heure', 0.44704], ['nd', 'nœud', 1852 / 3600], ['ft/s', 'pied par seconde', 0.3048]] },
  time: { name: 'Durée', defaults: [4, 0], units: [['s', 'seconde', 1], ['ms', 'milliseconde', 1e-3], ['µs', 'microseconde', 1e-6], ['min', 'minute', 60], ['h', 'heure', 3600], ['j', 'jour', 86400], ['sem', 'semaine', 604800], ['an', 'année (365,25 j)', 31557600]] },
  data: { name: 'Données', defaults: [4, 8], units: [['bit', 'bit', 0.125], ['o', 'octet', 1], ['ko', 'kilooctet', 1e3], ['Mo', 'mégaoctet', 1e6], ['Go', 'gigaoctet', 1e9], ['To', 'téraoctet', 1e12], ['Kio', 'kibioctet', 1024], ['Mio', 'mébioctet', 1048576], ['Gio', 'gibioctet', 1073741824], ['Tio', 'tébioctet', 1099511627776]] },
  energy: { name: 'Énergie', defaults: [3, 0], units: [['J', 'joule', 1], ['kJ', 'kilojoule', 1e3], ['cal', 'calorie', 4.184], ['kcal', 'kilocalorie', 4184], ['Wh', 'wattheure', 3600], ['kWh', 'kilowattheure', 3.6e6], ['eV', 'électronvolt', 1.602176634e-19], ['BTU', 'British thermal unit', 1055.05585262], ['tep', 'tonne équivalent pétrole', 4.1868e10]] },
  power: { name: 'Puissance', defaults: [1, 4], units: [['W', 'watt', 1], ['kW', 'kilowatt', 1e3], ['MW', 'mégawatt', 1e6], ['ch', 'cheval-vapeur', 735.49875], ['hp', 'horsepower', 745.69987158227], ['BTU/h', 'BTU par heure', 0.29307107017]] },
  pressure: { name: 'Pression', defaults: [4, 7], units: [['Pa', 'pascal', 1], ['hPa', 'hectopascal', 100], ['kPa', 'kilopascal', 1e3], ['bar', 'bar', 1e5], ['mbar', 'millibar', 100], ['atm', 'atmosphère', 101325], ['mmHg', 'millimètre de mercure', 133.322387415], ['psi', 'livre par pouce carré', 6894.757293168]] },
  angle: { name: 'Angle', defaults: [0, 1], units: [['°', 'degré', PI / 180], ['rad', 'radian', 1], ['gon', 'grade', PI / 200], ['′', 'minute d’arc', PI / 10800], ['″', 'seconde d’arc', PI / 648000], ['tr', 'tour', 2 * PI]] },
};

const U: { cat: Category; from: number; to: number } = { cat: 'length', from: 1, to: 6 };

/* température : base en kelvins (°C, °F, K) */
function toBase(cat: Category, i: number, v: number): number {
  if (cat !== 'temp') return v * UNITS[cat].units[i][2];
  return [v + 273.15, ((v - 32) * 5) / 9 + 273.15, v][i];
}
function fromBase(cat: Category, i: number, v: number): number {
  if (cat !== 'temp') return v / UNITS[cat].units[i][2];
  return [v - 273.15, ((v - 273.15) * 9) / 5 + 32, v][i];
}

function renderCategories(): void {
  $('uCats').innerHTML = (Object.keys(UNITS) as Category[])
    .map((k) => `<k3-chip variant="filter" value="${k}"${k === U.cat ? ' selected' : ''}>${esc(UNITS[k].name)}</k3-chip>`)
    .join('');
}

function renderSelects(): void {
  const items = UNITS[U.cat].units.map(([s, n], i) => [i, `${s} · ${n}`] as const);
  fillSelect($('uFrom', 'k3-select'), items, U.from);
  fillSelect($('uTo', 'k3-select'), items, U.to);
  convert();
}

function convert(): void {
  const err = $('uErr'), field = $('uVal', 'k3-text-field');
  let v: number;
  try {
    v = evalReal(field.value);
    err.textContent = '';
    field.error = '';
  } catch (e) {
    err.textContent = e instanceof CalcError ? e.message : 'Erreur';
    field.error = ' ';
    $('uOut').textContent = '—';
    return;
  }
  const base = toBase(U.cat, U.from, v);
  const list = UNITS[U.cat].units;
  $('uOut').textContent = fmtReal(fromBase(U.cat, U.to, base)) + ' ' + list[U.to][0];
  $('uTable').innerHTML = `<tbody>${list
    .map(([s, n], i) => `<tr data-i="${i}" class="${i === U.to ? 'sel' : ''}" title="Choisir comme unité d’arrivée"><td>${esc(s)}</td><td>${esc(n)}</td><td>${esc(fmtReal(fromBase(U.cat, i, base)))}</td></tr>`)
    .join('')}</tbody>`;
}

export function initUnits(): void {
  renderCategories();
  renderSelects();
  $('uCats').addEventListener('k3-change', (e) => {
    const chip = (e as CustomEvent<K3ChipSetDetail>).detail?.chip ?? fromPath<K3ChipElement>(e, 'k3-chip');
    const v = chip?.value as Category | undefined;
    if (!chip || !v || !chip.selected || !(v in UNITS)) {
      renderCategories();
      return;
    }
    U.cat = v;
    [U.from, U.to] = UNITS[v].defaults;
    renderSelects();
  });
  $('uVal').addEventListener('k3-input', convert);
  const from = $('uFrom', 'k3-select'), to = $('uTo', 'k3-select');
  from.addEventListener('k3-change', (e) => {
    U.from = Number(inputValue(e, from));
    convert();
  });
  to.addEventListener('k3-change', (e) => {
    U.to = Number(inputValue(e, to));
    convert();
  });
  $('uSwap').addEventListener('click', () => {
    [U.from, U.to] = [U.to, U.from];
    from.value = String(U.from);
    to.value = String(U.to);
    convert();
  });
  $('uTable').addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('tr[data-i]');
    if (!row) return;
    U.to = Number(row.dataset.i);
    to.value = String(U.to);
    convert();
  });
}
