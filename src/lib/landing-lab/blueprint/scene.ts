/**
 * The blueprint moment on one 2D canvas, as a pure function of scroll progress p (0..1):
 * hero (pencil underdrawing + axes) → ink draws itself in drafting order → red-pencil AI
 * marks → the plan tilts into an axonometric, walls rise → the upper storeys lift into an
 * exploded axonometric with leader lines → resting frame. Same p, same pixels.
 */

import { drawAxes, drawDims, drawOverhead, drawPlate, drawTags, SANS, SERIF } from './annot';
import { bounds, easeInOut, easeOutBack, fit, lerp, mixBounds, project, raw, smooth, span, type Bounds, type Cam, type Rect } from './camera';
import { drawFloor, drawUnder, type Cat, type Kit } from './floor';
import { drawMarks } from './marks';
import { FLOORS, type Floor, type V2 } from './model';
import { hatchPattern, linePattern, PEN, rand, type Palette } from './pen';

const STOREY = 3375;
const EXPLODED = 15000;
const CUT = 1300;
const PLINTH = 450;
const SLAB = 300;

/** Phase boundaries on p. */
export const PHASE = { draw: [0.05, 0.36], ai: [0.37, 0.515], tilt: [0.535, 0.7], up: [0.7, 0.82], explode: [0.71, 0.91], rest: 0.93 } as const;

type Win = readonly [number, number];
/** Exterior walls are inked on load (`intro`); the rest follows the scroll, the terrace boards late. */
const DRAW_WIN: Record<Cat, Win> = { ext: [0, 1], int: [0, 0.3], open: [0.22, 0.48], stair: [0.38, 0.56], deck: [0.62, 0.8], furn: [0.45, 0.75] };
const UP_WIN: Record<Cat, Win> = { ext: [0, 0.35], int: [0.15, 0.55], open: [0.35, 0.7], stair: [0.45, 0.75], deck: [0, 1], furn: [0.5, 1] };

/** Drafting rhythm: items start one after another with a little hand-timed jitter. */
function stagger(d: number, win: Win, i: number, n: number, seed: number): number {
  const [a, b] = win;
  const len = b - a;
  const start = a + len * 0.62 * (i / Math.max(1, n)) + (rand(seed * 31 + i) - 0.5) * len * 0.06;
  const dur = len * (0.3 + rand(seed * 17 + i) * 0.12);
  return easeInOut(span(d, start, start + dur));
}

export function figureRect(p: number, W: number, H: number): Rect {
  // Portrait (768 x 1024): text on top, figure below. Landscape sizes keep the book spread.
  const narrow = W / H < 1.1;
  const hero: Rect = narrow ? { x: 0.08 * W, y: 0.5 * H, w: 0.84 * W, h: 0.4 * H } : { x: 0.5 * W, y: 0.16 * H, w: 0.45 * W, h: 0.68 * H };
  const plan: Rect = narrow ? { x: 0.06 * W, y: 0.41 * H, w: 0.88 * W, h: 0.49 * H } : { x: 0.37 * W, y: 0.11 * H, w: 0.59 * W, h: 0.75 * H };
  const axo: Rect = narrow ? { x: 0.06 * W, y: 0.39 * H, w: 0.7 * W, h: 0.52 * H } : { x: 0.37 * W, y: 0.095 * H, w: 0.47 * W, h: 0.82 * H };
  const a = easeInOut(span(p, 0.02, 0.12));
  const b = easeInOut(span(p, 0.55, 0.78));
  const mix = (r: Rect, s: Rect, t: number): Rect => ({ x: lerp(r.x, s.x, t), y: lerp(r.y, s.y, t), w: lerp(r.w, s.w, t), h: lerp(r.h, s.h, t) });
  return mix(mix(hero, plan, a), axo, b);
}

interface Pose {
  readonly z: readonly number[];
  readonly ink: readonly number[];
  readonly cut: number;
  readonly tilt: number;
  readonly up: number;
}

function pose(p: number): Pose {
  const tilt = easeInOut(span(p, PHASE.tilt[0], PHASE.tilt[1]));
  const up = span(p, PHASE.up[0], PHASE.up[1]);
  const e2 = easeOutBack(span(p, PHASE.explode[0], PHASE.explode[1] - 0.03), 0.6);
  const e3 = easeOutBack(span(p, PHASE.explode[0] + 0.03, PHASE.explode[1]), 1.1);
  return {
    z: [0, lerp(STOREY, EXPLODED, e2), lerp(2 * STOREY, 2 * EXPLODED, e3)],
    // Upper storeys turn solid fast (clean occlusion, no see-through ghost) while their lines draw on.
    ink: [1, smooth(0, 0.3, up), smooth(0.05, 0.35, up)],
    cut: CUT * easeInOut(span(p, 0.56, 0.7)),
    tilt,
    up,
  };
}

/** Unscaled screen bounds of what is on the sheet at this pose. */
function sheetBounds(theta: number, phi: number, ps: Pose): Bounds {
  const corners = (f: Floor, z0: number, lo: number, hi: number): V2[] => f.slab.flatMap((q) => [raw(theta, phi, q[0], q[1], z0 + lo), raw(theta, phi, q[0], q[1], z0 + hi)]);
  const t1 = FLOORS[0];
  if (t1 === undefined) return bounds([]);
  const base = [...corners(t1, 0, -PLINTH * ps.tilt, ps.cut), raw(theta, phi, 4000, 25000, 0), raw(theta, phi, 28000, 25000, 0)];
  const extras = [raw(theta, phi, 1000, 4700, 0), raw(theta, phi, 29700, 26000, 0), raw(theta, phi, 30200, 3500, 0)];
  const plain = bounds(base);
  const own = mixBounds(bounds([...base, ...extras]), plain, ps.tilt);
  const w = smooth(0, 0.7, ps.up);
  if (w <= 0) return own;
  const all = [...base];
  FLOORS.slice(1).forEach((f, i) => all.push(...corners(f, ps.z[i + 1] ?? 0, -SLAB, CUT)));
  return mixBounds(own, bounds(all), w);
}

export interface SceneInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly W: number;
  readonly H: number;
  readonly dpr: number;
  readonly pal: Palette;
  readonly paper: HTMLImageElement | null;
}

/** `draw(p, intro)`: `intro` 0..1 is the on-load inking of the axes and exterior walls. */
export function createScene(input: SceneInput): { draw: (p: number, intro?: number) => void } {
  const { ctx, W, H, dpr, pal } = input;
  const paperPat = input.paper === null ? null : ctx.createPattern(input.paper, 'repeat');
  const kit: Kit = {
    ctx,
    pal,
    paper: paperPat ?? pal.paper,
    hatch: hatchPattern(ctx, pal.ink, 4, 0.55, 0.75, dpr),
    shade: linePattern(ctx, pal.ink, 2.6, 0.5, 0.42, dpr),
    k: Math.min(1.1, Math.max(0.82, W / 1920)),
  };

  const draw = (p: number, intro = 1): void => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    // The sheet itself is the stage's CSS background (same tile, same origin); paper fills below line up with it.
    ctx.clearRect(0, 0, W, H);
    const ps = pose(p);
    const theta = lerp(0, -0.56, ps.tilt);
    const phi = lerp(Math.PI / 2, 0.55, ps.tilt);
    const cam: Cam = fit(theta, phi, sheetBounds(theta, phi, ps), figureRect(p, W, H));
    const planFade = 1 - span(p, PHASE.tilt[0], PHASE.tilt[0] + 0.05);
    const d = span(p, PHASE.draw[0], PHASE.draw[1]);
    const t1 = FLOORS[0];
    if (t1 === undefined) return;

    drawUnder(kit, cam, t1, 0.3 * (1 - span(p, 0.3, 0.42)));
    drawAxes(kit, cam, planFade, intro);
    drawFloor(kit, cam, t1, {
      z0: 0,
      cut: ps.cut,
      ink: 1,
      slab: ps.tilt,
      slabMm: PLINTH,
      reveal: (cat, i, n) => stagger(cat === 'ext' ? intro : d, DRAW_WIN[cat], i, n, 1),
    });
    drawOverhead(kit, cam, planFade, stagger(d, [0.66, 0.82], 0, 1, 2));
    drawDims(kit, cam, planFade, span(d, 0.7, 0.92));
    drawTags(kit, cam, t1, planFade, span(d, 0.82, 1));
    drawPlate(kit, cam, planFade * span(d, 0.85, 1));
    drawMarks(kit, cam, span(p, PHASE.ai[0], PHASE.ai[1]), 1 - span(p, PHASE.tilt[0], PHASE.tilt[0] + 0.04));

    FLOORS.slice(1).forEach((f, j) => {
      const i = j + 1;
      if (ps.up <= 0) return;
      leaders(kit, cam, FLOORS[i - 1], f, ps.z[i - 1] ?? 0, ps.z[i] ?? 0, span(p, 0.76, 0.9));
      drawFloor(kit, cam, f, {
        z0: ps.z[i] ?? 0,
        cut: CUT,
        ink: ps.ink[i] ?? 0,
        slab: 1,
        slabMm: SLAB,
        reveal: (cat, k, n) => stagger(ps.up, UP_WIN[cat], k, n, i + 3),
      });
    });
    const la = span(p, 0.84, 0.93);
    const col = Math.max(...FLOORS.map((f, i) => eastCorner(cam, f, ps.z[i] ?? 0)[0])) + 36 * kit.k;
    FLOORS.forEach((f, i) => label(kit, cam, f, ps.z[i] ?? 0, i, la, col));
  };
  return { draw };
}

/** Thin dashed verticals from the upper slab's corners down to the storey below. */
function leaders(kit: Kit, cam: Cam, lower: Floor | undefined, upper: Floor, zLow: number, zUp: number, r: number): void {
  if (lower === undefined || r <= 0) return;
  const { ctx, k } = kit;
  const lb = bounds(lower.slab);
  ctx.save();
  ctx.strokeStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * k;
  ctx.setLineDash([3 * k, 3 * k]);
  ctx.globalAlpha = 0.9;
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

const NAMES = ['Tầng 1', 'Tầng 2', 'Tầng 3'];

/** "Tầng n" in the right margin, tied to the slab's east corner by a hairline. */
function eastCorner(cam: Cam, f: Floor, z0: number): V2 {
  const pts = f.slab.map((q) => project(cam, q[0], q[1], z0));
  return pts.reduce((m, q) => (q[0] > m[0] ? q : m), pts[0] ?? [0, 0]);
}

function label(kit: Kit, cam: Cam, f: Floor, z0: number, i: number, alpha: number, lx: number): void {
  if (alpha <= 0) return;
  const { ctx, k } = kit;
  const east = eastCorner(cam, f, z0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = kit.pal.ink;
  ctx.fillStyle = kit.pal.ink;
  ctx.lineWidth = PEN.hair * k;
  ctx.beginPath();
  ctx.moveTo(east[0] + 6 * k, east[1]);
  ctx.lineTo(lerp(east[0] + 6 * k, lx - 6 * k, alpha), east[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(east[0] + 3 * k, east[1], 1.6 * k, 0, 2 * Math.PI);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 400 ${String(22 * k)}px ${SERIF}`;
  ctx.fillText(NAMES[i] ?? '', lx, east[1] + 6 * k);
  ctx.font = `300 ${String(11 * k)}px ${SANS}`;
  ctx.fillText(`${String(f.m2)} m² sàn · ${String(f.rooms.length)} phòng`, lx, east[1] + 24 * k);
  ctx.restore();
}
