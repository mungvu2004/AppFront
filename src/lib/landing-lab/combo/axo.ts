/**
 * Chapter 2b, "Tách tầng": C's exploded axonometric inside the combo, in the true top-view frame (flip).
 * Local progress u (0..1): the plan tilts and its walls rise → the upper storeys draw in and lift apart with
 * leaders and labels → a short drift → they come back down and fade into the plan, the sheet tilts back flat
 * with a small settle, and the red pencil returns, so the page that leaves for the desk is the printed one.
 */

import { drawAxes, drawDims, drawOverhead, drawPlate, drawTags, SANS, SERIF } from '../blueprint/annot';
import { bounds, easeInOut, easeOutBack, fit, lerp, mixBounds, project, raw, span, type Bounds, type Cam, type Rect } from '../blueprint/camera';
import { drawFloor, type Cat, type Kit } from '../blueprint/floor';
import { drawMarks } from '../blueprint/marks';
import { FLOORS, type Floor, type V2 } from '../blueprint/model';
import { PEN, rand } from '../blueprint/pen';
import { drawSection, levelMarks } from './section';
import { SHEET } from './sheet';

const STOREY = 3375;
const EXPLODED = 15000;
const CUT = 1300;
const PLINTH = 450;
const SLAB = 300;
const ss = (t: number): number => t * t * (3 - 2 * t);

const UP_WIN: Record<Cat, readonly [number, number]> = { ext: [0, 0.35], int: [0.15, 0.55], open: [0.35, 0.7], stair: [0.45, 0.75], deck: [0, 1], furn: [0.5, 1] };

function stagger(d: number, win: readonly [number, number], i: number, n: number, seed: number): number {
  const [a, b] = win;
  const len = b - a;
  const start = a + len * 0.62 * (i / Math.max(1, n)) + (rand(seed * 31 + i) - 0.5) * len * 0.06;
  return easeInOut(span(d, start, start + len * (0.3 + rand(seed * 17 + i) * 0.12)));
}

export interface AxoPose {
  readonly u: number;
  readonly tilt: number;
  readonly theta: number;
  readonly phi: number;
  readonly cut: number;
  readonly z: readonly number[];
  readonly up: number;
  readonly ink: readonly number[];
  /** 0..1 how much of the plan's annotation and red pencil shows. */
  readonly plan: number;
  readonly labels: number;
}

export function axoPose(u: number): AxoPose {
  // Tilt up, then back down with a little overshoot past flat (the settle).
  const tilt = u < 0.5 ? easeInOut(span(u, 0, 0.26)) : 1 - easeOutBack(span(u, 0.7, 0.96), 0.6);
  const rise = u < 0.5 ? easeInOut(span(u, 0.06, 0.28)) : 1 - easeInOut(span(u, 0.72, 0.86));
  const out2 = easeOutBack(span(u, 0.22, 0.46), 0.6) * (1 - easeInOut(span(u, 0.54, 0.7)));
  const out3 = easeOutBack(span(u, 0.25, 0.49), 1.1) * (1 - easeInOut(span(u, 0.52, 0.68)));
  const up = span(u, 0.2, 0.38);
  // Solid while they come down (clean occlusion), then a quick erase once they have landed.
  const fade = 1 - span(u, 0.69, 0.74);
  // A slow drift while the floors hang apart, so the frame never stops.
  const drift = 0.06 * ss(span(u, 0.3, 0.62));
  return {
    u,
    tilt,
    theta: lerp(0, -0.56, tilt) - drift * tilt,
    phi: lerp(Math.PI / 2, 0.55, tilt),
    cut: CUT * rise,
    z: [0, lerp(STOREY, EXPLODED, out2), lerp(2 * STOREY, 2 * EXPLODED, out3)],
    up,
    ink: [1, ss(span(up, 0, 0.3)) * fade, ss(span(up, 0.05, 0.35)) * fade],
    plan: Math.max(1 - span(u, 0, 0.08), span(u, 0.86, 0.98)),
    labels: span(u, 0.34, 0.44) * (1 - span(u, 0.54, 0.6)),
  };
}

function poseBounds(ps: AxoPose): Bounds {
  const r = (x: number, y: number, z: number): V2 => raw(ps.theta, ps.phi, x, y, z, true);
  const window = bounds([r(SHEET.x0, SHEET.y0, 0), r(SHEET.x0 + SHEET.w, SHEET.y0, 0), r(SHEET.x0, SHEET.y0 + SHEET.h, 0), r(SHEET.x0 + SHEET.w, SHEET.y0 + SHEET.h, 0)]);
  const corners = (f: Floor, z0: number, lo: number, hi: number): V2[] => f.slab.flatMap((q) => [r(q[0], q[1], z0 + lo), r(q[0], q[1], z0 + hi)]);
  const t1 = FLOORS[0];
  if (t1 === undefined) return window;
  const pts = [...corners(t1, 0, -PLINTH, CUT), r(4000, 25000, 0), r(28000, 25000, 0)];
  FLOORS.slice(1).forEach((f, i) => pts.push(...corners(f, ps.z[i + 1] ?? 0, -SLAB, CUT)));
  // Frame the whole exploded stack from the first tilt, so the camera does not breathe as the floors move.
  const all = [...pts];
  FLOORS.slice(1).forEach((f, i) => all.push(...corners(f, (i + 1) * EXPLODED, -SLAB, CUT)));
  const pad = 2500;
  const b = bounds(all);
  return mixBounds(window, { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad * 3, maxY: b.maxY + pad }, Math.min(1, Math.max(0, ps.tilt)));
}

export function axoCam(ps: AxoPose, r: Rect): Cam {
  return { ...fit(ps.theta, ps.phi, poseBounds(ps), r), flip: true };
}

const NAMES = ['Tầng 1', 'Tầng 2', 'Tầng 3'];

function eastCorner(cam: Cam, f: Floor, z0: number): V2 {
  const pts = f.slab.map((q) => project(cam, q[0], q[1], z0));
  return pts.reduce((m, q) => (q[0] > m[0] ? q : m), pts[0] ?? [0, 0]);
}

function label(kit: Kit, cam: Cam, f: Floor, z0: number, i: number, a: number, lx: number): void {
  const { ctx, k } = kit;
  const e = eastCorner(cam, f, z0);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a * 1.5);
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * k * 1.3;
  ctx.beginPath();
  ctx.moveTo(e[0] + 6 * k, e[1]);
  ctx.lineTo(lerp(e[0] + 6 * k, lx - 6 * k, a), e[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(e[0] + 3 * k, e[1], 1.8 * k, 0, 2 * Math.PI);
  ctx.fill();
  ctx.globalAlpha = ss(span(a, 0.5, 1));
  ctx.font = `italic 400 ${String(22 * k)}px ${SERIF}`;
  ctx.fillText(NAMES[i] ?? '', lx, e[1] + 6 * k);
  ctx.font = `300 ${String(11 * k)}px ${SANS}`;
  ctx.fillText(`${String(f.m2)} m² sàn · ${String(f.rooms.length)} phòng`, lx, e[1] + 24 * k);
  ctx.restore();
}

function leaders(kit: Kit, cam: Cam, lower: Floor | undefined, upper: Floor, zLow: number, zUp: number, r: number): void {
  if (lower === undefined || r <= 0 || zUp - zLow < STOREY * 1.2) return;
  const { ctx, k } = kit;
  const lb = bounds(lower.slab);
  ctx.save();
  ctx.strokeStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * k;
  ctx.setLineDash([3 * k, 3 * k]);
  for (const q of upper.slab) {
    const inside = q[0] >= lb.minX && q[0] <= lb.maxX && q[1] >= lb.minY && q[1] <= lb.maxY;
    const a = project(cam, q[0], q[1], zUp - SLAB);
    const b = project(cam, q[0], q[1], zLow + (inside ? CUT : 0));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(lerp(a[0], b[0], r), lerp(a[1], b[1], r));
    ctx.stroke();
  }
  ctx.restore();
}

export interface AxoExtra {
  /** Where the section sits; its level lines extend as the guides the floors snap onto. */
  readonly section: Rect;
  /** Screen centres of the small plans (tầng 1-3) the upper floors fly in from. */
  readonly from: readonly V2[];
}

function slabCentre(cam: Cam, f: Floor, z: number): V2 {
  const b = bounds(f.slab);
  return project(cam, (b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, z);
}

/** Section level line → jog → horizontal datum at each floor's final (exploded) height. */
function guides(kit: Kit, cam: Cam, ex: AxoExtra, alpha: number, r: number, col: number): void {
  if (alpha <= 0 || r <= 0) return;
  const { ctx, k } = kit;
  const marks = levelMarks(ex.section);
  ctx.save();
  ctx.strokeStyle = kit.pal.ink;
  ctx.globalAlpha = alpha * 0.7;
  ctx.lineWidth = PEN.hair * k;
  ctx.setLineDash([6 * k, 4 * k]);
  FLOORS.forEach((f, i) => {
    const m = marks[i];
    if (m === undefined) return;
    const z = i * EXPLODED;
    const pts = f.slab.map((q) => project(cam, q[0], q[1], z));
    const y = eastCorner(cam, f, z)[1];
    const west = Math.min(...pts.map((q) => q[0]));
    ctx.beginPath();
    ctx.moveTo(m[0] + 70 * k, m[1]);
    const knee = m[0] + 70 * k + 30 * k;
    const path: V2[] = [[m[0] + 70 * k, m[1]], [knee, m[1]], [Math.max(knee + 20 * k, west - 40 * k), y], [col + 150 * k, y]];
    let left = r * path.slice(1).reduce((s2, q, j) => s2 + Math.hypot(q[0] - (path[j]?.[0] ?? 0), q[1] - (path[j]?.[1] ?? 0)), 0);
    for (let j = 1; j < path.length && left > 0; j += 1) {
      const a = path[j - 1] ?? m;
      const b = path[j] ?? m;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const t = Math.min(1, left / d);
      ctx.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      left -= d;
    }
    ctx.stroke();
  });
  ctx.restore();
}

/** The whole 2b frame. `kit.k` stays the plan's pen scale so line weights do not jump. */
export function drawAxo(kit: Kit, cam: Cam, ps: AxoPose, ex: AxoExtra): void {
  const t1 = FLOORS[0];
  if (t1 === undefined) return;
  const pa = ps.plan;
  const sa = span(ps.u, 0, 0.1) * (1 - span(ps.u, 0.56, 0.66));
  drawSection({ ...kit, k: kit.k * 0.8 }, ex.section, 1, sa);
  const col = Math.max(...FLOORS.map((f, i) => eastCorner(cam, f, i * EXPLODED)[0])) + 36 * kit.k;
  guides(kit, cam, ex, sa, span(ps.u, 0.06, 0.3), col);
  drawAxes(kit, cam, pa, 1);
  drawFloor(kit, cam, t1, { z0: 0, cut: ps.cut, ink: 1, slab: Math.min(1, Math.max(0, ps.tilt)), slabMm: PLINTH, reveal: () => 1 });
  drawOverhead(kit, cam, pa, 1);
  drawDims(kit, cam, pa, 1);
  drawTags(kit, cam, t1, pa, 1);
  drawPlate(kit, cam, pa);
  drawMarks(kit, cam, 1, pa);
  FLOORS.slice(1).forEach((f, j) => {
    const i = j + 1;
    const ink = ps.ink[i] ?? 0;
    if (ps.up <= 0 || ink <= 0.003) return;
    leaders(kit, cam, FLOORS[i - 1], f, ps.z[i - 1] ?? 0, ps.z[i] ?? 0, Math.min(ink, ps.labels * 1.5));
    // Fly in from its small plan on the spread while it tilts and lifts.
    const from = ex.from[i];
    const fly = 1 - easeInOut(span(ps.u, 0.18, 0.42));
    const c = slabCentre(cam, f, ps.z[i] ?? 0);
    kit.ctx.save();
    if (from !== undefined && fly > 0) kit.ctx.translate((from[0] - c[0]) * fly, (from[1] - c[1]) * fly);
    drawFloor(kit, cam, f, { z0: ps.z[i] ?? 0, cut: CUT, ink, slab: 1, slabMm: SLAB, reveal: (cat, k, n) => stagger(ps.up, UP_WIN[cat], k, n, i + 3) });
    kit.ctx.restore();
  });
  if (ps.labels > 0) {
    FLOORS.forEach((f, i) => label(kit, cam, f, ps.z[i] ?? 0, i, ps.labels, col));
  }
}
