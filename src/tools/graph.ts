import { CalcError, fmtReal, makeRealFn, minus, parse } from '../engine';
import { on } from '../ui/bus';
import { $, esc, inputValue } from '../ui/dom';
import { opts } from '../ui/state';

interface PlotFn {
  src: string;
  on: boolean;
}
type RealFn = (x: number) => number;

const SERIES = ['--k3-sys-color-primary', '--k3-sys-color-tertiary', '--k3-sys-color-error'] as const;
const SUB = ['₁', '₂', '₃'];

const view = { xmin: -10, xmax: 10, ymin: -6, ymax: 6, W: 0, H: 0, dpr: 1, sized: false };
let hover: number | null = null;
const fns: PlotFn[] = [
  { src: 'X^3/10−X', on: true },
  { src: '√(X+5)', on: true },
  { src: '2cos(30X)', on: true },
];
let compiled: Array<RealFn | null> = [];

const canvas = (): HTMLCanvasElement => $<HTMLCanvasElement>('plot');

function renderFnRows(): void {
  $('fnRows').innerHTML = fns
    .map(
      (f, i) => `
    <div class="fnrow">
      <k3-switch id="fon${i}" ${f.on ? 'selected' : ''} aria-label="Afficher y${i + 1}"></k3-switch>
      <k3-text-field id="fsrc${i}" variant="outlined" label="y${SUB[i]} = f(X)" no-form><span slot="leading-icon" class="dot" style="--c:var(${SERIES[i]})"></span></k3-text-field>
    </div>`,
    )
    .join('');
  fns.forEach((f, i) => {
    const field = $(`fsrc${i}`, 'k3-text-field');
    field.value = f.src;
    field.addEventListener('k3-input', (e) => {
      f.src = inputValue(e, field);
      compileFns();
      drawPlot();
    });
    const toggle = $(`fon${i}`, 'k3-switch');
    toggle.addEventListener('k3-change', (e) => {
      f.on = (e as CustomEvent<Partial<K3SelectedDetail>>).detail?.selected ?? toggle.selected;
      drawPlot();
    });
  });
}

/** Compile les fonctions saisies (les erreurs s'affichent sous le champ). */
function compileFns(): void {
  compiled = fns.map((f, i) => {
    const field = document.getElementById(`fsrc${i}`) as K3TextFieldElement | null;
    const s = f.src.trim().replace(/^y\s*=\s*/i, '');
    if (field) field.error = '';
    if (!s) return null;
    try {
      return makeRealFn(parse(s), opts({ mode: 'comp' }), 'X');
    } catch (e) {
      if (field) field.error = e instanceof CalcError ? e.message : 'Erreur';
      return null;
    }
  });
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function tickLabel(v: number, step: number): string {
  if (Math.abs(v) < step * 1e-6) return '0';
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  if (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-3) return minus(v.toExponential(1));
  return minus(v.toFixed(dec));
}

function sizePlot(): void {
  const r = $('plotWrap').getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;
  const c = canvas();
  view.dpr = window.devicePixelRatio || 1;
  c.width = Math.round(r.width * view.dpr);
  c.height = Math.round(r.height * view.dpr);
  const cy = (view.ymin + view.ymax) / 2, unitsPerPx = (view.xmax - view.xmin) / r.width;
  const firstSize = !view.sized || !view.H;
  view.W = r.width;
  view.H = r.height;
  /* repère orthonormé au premier affichage */
  if (firstSize) {
    const yr = unitsPerPx * r.height;
    view.ymin = cy - yr / 2;
    view.ymax = cy + yr / 2;
    view.sized = true;
  }
  drawPlot();
}

function drawPlot(): void {
  const c = document.getElementById('plot') as HTMLCanvasElement | null;
  const ctx = c?.getContext('2d');
  if (!c || !ctx || !view.W) return;
  const cs = getComputedStyle(document.documentElement);
  const col = (n: string): string => cs.getPropertyValue(n).trim();
  const { W, H, xmin, xmax, ymin, ymax } = view;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = col('--k3-sys-color-surface-container-lowest') || '#fff';
  ctx.fillRect(0, 0, W, H);
  const sx = (x: number): number => ((x - xmin) / (xmax - xmin)) * W;
  const sy = (y: number): number => H - ((y - ymin) / (ymax - ymin)) * H;
  const xs = niceStep((xmax - xmin) / Math.max(2, W / 90));
  const ys = niceStep((ymax - ymin) / Math.max(2, H / 64));

  const grid = (stepX: number, stepY: number, color: string): void => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let x = Math.ceil(xmin / stepX) * stepX; x <= xmax; x += stepX) {
      const p = Math.round(sx(x)) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, H);
    }
    for (let y = Math.ceil(ymin / stepY) * stepY; y <= ymax; y += stepY) {
      const p = Math.round(sy(y)) + 0.5;
      ctx.moveTo(0, p);
      ctx.lineTo(W, p);
    }
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  grid(xs / 5, ys / 5, col('--k3-sys-color-surface-container-high'));
  grid(xs, ys, col('--k3-sys-color-outline-variant'));

  /* axes */
  const ax = Math.round(sx(0)) + 0.5, ay = Math.round(sy(0)) + 0.5;
  ctx.strokeStyle = col('--k3-sys-color-on-surface-variant');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (ax > 0 && ax < W) {
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, H);
  }
  if (ay > 0 && ay < H) {
    ctx.moveTo(0, ay);
    ctx.lineTo(W, ay);
  }
  ctx.stroke();

  /* graduations */
  ctx.fillStyle = col('--k3-sys-color-on-surface-variant');
  ctx.font = '12px ' + (col('--f-code') || 'monospace');
  const ly = Math.min(Math.max(ay + 14, 14), H - 5);
  ctx.textAlign = 'center';
  for (let x = Math.ceil(xmin / xs) * xs; x <= xmax; x += xs) {
    if (Math.abs(x) < xs * 1e-6) continue;
    const p = sx(x);
    if (p >= 12 && p <= W - 12) ctx.fillText(tickLabel(x, xs), p, ly);
  }
  const right = ax + 6 > W - 40;
  ctx.textAlign = right ? 'right' : 'left';
  const lx = right ? W - 6 : Math.max(ax + 6, 6);
  for (let y = Math.ceil(ymin / ys) * ys; y <= ymax; y += ys) {
    if (Math.abs(y) < ys * 1e-6) continue;
    const p = sy(y);
    if (p >= 10 && p <= H - 8) ctx.fillText(tickLabel(y, ys), lx, p + 4);
  }
  if (ax > 0 && ax < W && ay > 0 && ay < H) {
    ctx.textAlign = 'right';
    ctx.fillText('0', ax - 5, ay + 14);
  }

  /* courbes : on lève le crayon hors domaine et aux asymptotes */
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  compiled.forEach((f, i) => {
    if (!f || !fns[i].on) return;
    ctx.strokeStyle = col(SERIES[i]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    let pen = false, prev = 0;
    for (let px = 0; px <= W + 0.5; px += 0.5) {
      const y = f(xmin + (px / W) * (xmax - xmin));
      if (!isFinite(y)) {
        pen = false;
        continue;
      }
      let py = sy(y);
      if (pen && Math.abs(py - prev) > H * 1.5) pen = false;
      py = Math.max(-H * 3, Math.min(H * 4, py));
      if (pen) ctx.lineTo(px, py);
      else {
        ctx.moveTo(px, py);
        pen = true;
      }
      prev = py;
    }
    ctx.stroke();
  });

  /* lecture au survol */
  const ro = $('readout');
  if (hover === null) {
    ro.innerHTML = `<i>x ∈ [${esc(tickLabel(xmin, xs / 10))} ; ${esc(tickLabel(xmax, xs / 10))}]</i><i>y ∈ [${esc(tickLabel(ymin, ys / 10))} ; ${esc(tickLabel(ymax, ys / 10))}]</i>`;
    return;
  }
  const hx = hover;
  const x = xmin + (hx / W) * (xmax - xmin);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = col('--k3-sys-color-outline');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx + 0.5, 0);
  ctx.lineTo(hx + 0.5, H);
  ctx.stroke();
  ctx.setLineDash([]);
  const parts = [`<i><b>x</b> = ${esc(fmtReal(+x.toPrecision(6)))}</i>`];
  compiled.forEach((f, i) => {
    if (!f || !fns[i].on) return;
    const y = f(x);
    if (isFinite(y)) {
      ctx.fillStyle = col(SERIES[i]);
      ctx.beginPath();
      ctx.arc(hx, sy(y), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col('--k3-sys-color-surface-container-lowest');
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    parts.push(`<i><span class="dot" style="--c:var(${SERIES[i]})"></span><b>y${SUB[i]}</b> = ${isFinite(y) ? esc(fmtReal(+y.toPrecision(6))) : 'indéfini'}</i>`);
  });
  ro.innerHTML = parts.join('');
}

function zoomAt(px: number, py: number, factor: number): void {
  const x0 = view.xmin + (px / view.W) * (view.xmax - view.xmin);
  const y0 = view.ymax - (py / view.H) * (view.ymax - view.ymin);
  const span = (view.xmax - view.xmin) * factor;
  if (span < 1e-9 || span > 1e9) return;
  view.xmin = x0 - (x0 - view.xmin) * factor;
  view.xmax = x0 + (view.xmax - x0) * factor;
  view.ymin = y0 - (y0 - view.ymin) * factor;
  view.ymax = y0 + (view.ymax - y0) * factor;
  drawPlot();
}

/** Ajuste l'axe vertical aux courbes visibles (2ᵉ–98ᵉ centile, pour ignorer les asymptotes). */
function fitY(): void {
  const vals: number[] = [];
  compiled.forEach((f, i) => {
    if (!f || !fns[i].on) return;
    for (let k = 0; k <= 400; k++) {
      const y = f(view.xmin + (k / 400) * (view.xmax - view.xmin));
      if (isFinite(y)) vals.push(y);
    }
  });
  if (!vals.length) return;
  vals.sort((a, b) => a - b);
  let lo = vals[Math.floor(vals.length * 0.02)], hi = vals[Math.ceil(vals.length * 0.98) - 1];
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.1;
  view.ymin = lo - pad;
  view.ymax = hi + pad;
  drawPlot();
}

function resetView(): void {
  view.xmin = -10;
  view.xmax = 10;
  const yr = (20 * view.H) / view.W;
  view.ymin = -yr / 2;
  view.ymax = yr / 2;
  drawPlot();
}

function bindPointer(): void {
  const c = canvas();
  const pts = new Map<number, { x: number; y: number }>();
  let pinch: number | null = null;
  const pos = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  c.addEventListener('pointerdown', (e) => {
    c.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, pos(e));
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  c.addEventListener('pointermove', (e) => {
    const p = pos(e);
    const prev = pts.get(e.pointerId);
    if (prev) {
      if (pts.size === 1) {
        const dx = ((p.x - prev.x) / view.W) * (view.xmax - view.xmin);
        const dy = ((p.y - prev.y) / view.H) * (view.ymax - view.ymin);
        view.xmin -= dx;
        view.xmax -= dx;
        view.ymin += dy;
        view.ymax += dy;
      }
      pts.set(e.pointerId, p);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0) {
          zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d);
          pinch = d;
        }
      }
    }
    hover = e.pointerType === 'mouse' || pts.size === 1 ? p.x : null;
    drawPlot();
  });
  const end = (e: PointerEvent): void => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (e.pointerType !== 'mouse') {
      hover = null;
      drawPlot();
    }
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  c.addEventListener('pointerleave', () => {
    if (!pts.size) {
      hover = null;
      drawPlot();
    }
  });
  c.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = pos(e);
      zoomAt(p.x, p.y, Math.exp(e.deltaY * 0.0015));
    },
    { passive: false },
  );
}

export function initGraph(): void {
  renderFnRows();
  compileFns();
  bindPointer();
  $('gZin').addEventListener('click', () => zoomAt(view.W / 2, view.H / 2, 1 / 1.5));
  $('gZout').addEventListener('click', () => zoomAt(view.W / 2, view.H / 2, 1.5));
  $('gFit').addEventListener('click', fitY);
  $('gReset').addEventListener('click', resetView);
  new ResizeObserver(() => sizePlot()).observe($('plotWrap'));
  on('angle', () => {
    compileFns();
    drawPlot();
  });
  on('themeApplied', drawPlot);
  on('tabShown', (tab) => {
    if (tab === 'graph') requestAnimationFrame(sizePlot);
  });
  void document.fonts?.ready.then(() => requestAnimationFrame(drawPlot));
}
