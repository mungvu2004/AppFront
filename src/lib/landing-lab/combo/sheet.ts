/**
 * The combo's ground-floor sheet: C's ink plan + red-pencil pass in the TRUE top-view frame of the 3D house
 * (plan y down the sheet, street at the top, same frame as walls.json), so it registers on A's printed sheet.
 *
 * `SHEET` is the fixed plan-mm window the printed PNG covers; the page fits the same window on screen.
 */

import { LANDING_HOUSE } from '@/lib/landing/house';

import { drawAxes, drawDims, drawOverhead, drawPlate, drawTags } from '../blueprint/annot';
import { easeInOut, lerp, project, span, type Cam, type Rect } from '../blueprint/camera';
import { drawFloor, drawUnder, type Cat, type Kit } from '../blueprint/floor';
import { drawMarks } from '../blueprint/marks';
import { FLOORS, type Floor } from '../blueprint/model';
import { hatchPattern, linePattern, rand, type Palette } from '../blueprint/pen';
import { drawCutLine } from './section';

export interface Win {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
}

/** Plan-mm window of the sheet: x 0..32 m, y 2.5..26.5 m (walls.json frame). */
export const SHEET: Win = { x0: 0, y0: 2500, w: 32000, h: 24000 };
/** Tighter window for the small plans of the drawing set (all three storeys share it, so they line up). */
export const CELL: Win = { x0: 1000, y0: 4600, w: 29500, h: 22000 };

export const mixWin = (a: Win, b: Win, t: number): Win => ({ x0: lerp(a.x0, b.x0, t), y0: lerp(a.y0, b.y0, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

/** Counts across all three storeys for the tally (walls without guard rails, doors, rooms). */
export const ALL_COUNTS = {
  walls: LANDING_HOUSE.plan.walls.filter((w) => w.kind !== 'railing').length,
  doors: LANDING_HOUSE.plan.openings.filter((o) => o.kind === 'door').length,
  rooms: LANDING_HOUSE.rooms.length,
};

/** Screen px per plan mm at which C's pens look right with k = 1 (the 1920 book plate). */
const PEN_REF_S = 0.0373;

export function makeKit(ctx: CanvasRenderingContext2D, pal: Palette, paper: CanvasPattern | string, dpr: number, k: number): Kit {
  return {
    ctx,
    pal,
    paper,
    hatch: hatchPattern(ctx, pal.ink, 4, 0.55, 0.75, dpr),
    shade: linePattern(ctx, pal.ink, 2.6, 0.5, 0.42, dpr),
    k,
  };
}

/** Camera that maps a plan window onto `r` (letterboxed, centred), plan y down. */
export function planCam(r: Rect, win: Win): Cam {
  const s = Math.min(r.w / win.w, r.h / win.h);
  return {
    theta: 0,
    phi: Math.PI / 2,
    s,
    ox: r.x + (r.w - win.w * s) / 2 - win.x0 * s,
    oy: r.y + (r.h - win.h * s) / 2 - win.y0 * s,
    flip: true,
  };
}

export const sheetCam = (r: Rect): Cam => planCam(r, SHEET);

/** Pen scale for a sheet camera, so line weights match the book plate at any size. */
export const penScale = (cam: Cam): number => cam.s / PEN_REF_S;

type Span = readonly [number, number];
const WIN: Record<Cat, Span> = { ext: [0, 0.22], int: [0.12, 0.4], open: [0.3, 0.52], stair: [0.42, 0.6], deck: [0.62, 0.8], furn: [0.48, 0.78] };

function stagger(d: number, win: Span, i: number, n: number): number {
  const [a, b] = win;
  const len = b - a;
  const start = a + len * 0.62 * (i / Math.max(1, n)) + (rand(31 + i) - 0.5) * len * 0.06;
  return easeInOut(span(d, start, start + len * (0.3 + rand(17 + i) * 0.12)));
}

export interface SheetState {
  /** 0..1 ink drafting progress (axes and exterior walls are driven by `intro`). */
  readonly d: number;
  readonly intro: number;
  /** 0..1 red-pencil pass. */
  readonly q: number;
  /** Alpha of the faint pencil underdrawing. */
  readonly under: number;
  /** Alpha of the sheet-only annotation (dims, overhead line, scale bar); 1 when absent. */
  readonly annot?: number;
}

export function drawSheet(kit: Kit, cam: Cam, st: SheetState): void {
  const t1 = FLOORS[0];
  if (t1 === undefined) return;
  drawUnder(kit, cam, t1, st.under);
  drawAxes(kit, cam, 1, st.intro);
  drawFloor(kit, cam, t1, {
    z0: 0,
    cut: 0,
    ink: 1,
    slab: 0,
    slabMm: 0,
    reveal: (cat, i, n) => stagger(cat === 'ext' ? Math.min(st.intro, 1) * 0.22 + st.d * 0.78 : st.d, WIN[cat], i, n),
  });
  const an = st.annot ?? 1;
  drawOverhead(kit, cam, an, stagger(st.d, [0.66, 0.82], 0, 1));
  drawDims(kit, cam, an, span(st.d, 0.7, 0.92));
  drawTags(kit, cam, t1, 1, span(st.d, 0.82, 1));
  drawPlate(kit, cam, an * span(st.d, 0.85, 1));
  drawCutLine(kit, (x, y) => project(cam, x, y, 0), 1, span(st.d, 0.6, 0.85));
  drawMarks(kit, cam, st.q, 1);
}

/** One small plan of the drawing set: storey linework in drafting order `d`, room tags; the cut line on T1. */
export function drawMiniPlan(kit: Kit, cam: Cam, f: Floor, d: number, axes: number): void {
  if (d <= 0) return;
  if (axes > 0) drawAxes(kit, cam, axes, Math.min(1, d * 4));
  drawFloor(kit, cam, f, { z0: 0, cut: 0, ink: 1, slab: 0, slabMm: 0, reveal: (cat, i, n) => stagger(d, WIN[cat], i, n) });
  drawTags(kit, cam, f, 1, span(d, 0.82, 1));
  if (f.id === 'T1') drawCutLine(kit, (x, y) => project(cam, x, y, 0), 1, span(d, 0.6, 0.85));
}
