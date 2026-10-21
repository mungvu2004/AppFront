/**
 * Draws one storey through the camera: slab, floor-plane linework, cut walls (painter's
 * algorithm: far faces first, poché tops last), then window glass on the sills.
 *
 * The same routine draws the flat plan (phi = 90°, cut height 0: only the poché tops show)
 * and the axonometric (walls rise to `cut`), so the tilt is one continuous drawing.
 */

import { depth, facesViewer, project, type Cam } from './camera';
import type { Box, Floor, Stroke, V2 } from './model';
import { PEN, tracePartial, tracePoly, type Palette } from './pen';

export type Cat = 'ext' | 'int' | 'open' | 'stair' | 'furn' | 'deck';

export interface FloorStyle {
  readonly z0: number;
  /** Cut height of the walls in mm (0 in plan). */
  readonly cut: number;
  /** 0..1 how solid the drawing is: fills and pen alpha (ghost outlines below 1). */
  readonly ink: number;
  /** 0..1 how much of the slab (plinth edge, hatched cut face) shows. */
  readonly slab: number;
  readonly slabMm: number;
  /** Draw-on progress of item `i` of `n` in a category. */
  readonly reveal: (cat: Cat, i: number, n: number) => number;
}

export interface Kit {
  readonly ctx: CanvasRenderingContext2D;
  readonly pal: Palette;
  readonly paper: CanvasPattern | string;
  readonly hatch: CanvasPattern | null;
  readonly shade: CanvasPattern | null;
  /** Pen scale for the viewport. */
  readonly k: number;
}

const pen = (kit: Kit, p: Stroke['pen'] | 'poche'): number => PEN[p] * kit.k;

function centre(poly: readonly V2[]): V2 {
  return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length];
}

/** Outward unit normal of edge a→b of a convex polygon with centre c. */
function outward(a: V2, b: V2, c: V2): V2 {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  let n: V2 = [dy / l, -dx / l];
  const mx = (a[0] + b[0]) / 2 - c[0];
  const my = (a[1] + b[1]) / 2 - c[1];
  if (n[0] * mx + n[1] * my < 0) n = [-n[0], -n[1]];
  return n;
}

export function strokeAll(kit: Kit, cam: Cam, list: readonly Stroke[], z0: number, alpha: number, r: (i: number) => number): void {
  const { ctx } = kit;
  list.forEach((s, i) => {
    const t = r(i);
    if (t <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = pen(kit, s.pen);
    ctx.setLineDash(s.dashed === true ? [4 * kit.k, 3 * kit.k] : []);
    ctx.beginPath();
    tracePartial(
      ctx,
      s.pts.map((p) => project(cam, p[0], p[1], z0 + (s.z ?? 0))),
      t,
      s.closed === true,
    );
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

/** The hatched cut edge of a plate (slab or terrace), `mm` thick below z0. */
function edges(kit: Kit, cam: Cam, poly: readonly V2[], z0: number, mm: number): void {
  const { ctx } = kit;
  const c = centre(poly);
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length] ?? a;
    if (!facesViewer(cam.theta, outward(a, b, c))) return;
    const q = [project(cam, a[0], a[1], z0), project(cam, b[0], b[1], z0), project(cam, b[0], b[1], z0 - mm), project(cam, a[0], a[1], z0 - mm)];
    ctx.beginPath();
    tracePoly(ctx, q);
    ctx.fillStyle = kit.paper;
    ctx.fill();
    if (kit.hatch !== null) {
      ctx.fillStyle = kit.hatch;
      ctx.fill();
    }
    ctx.lineWidth = pen(kit, 'medium');
    ctx.stroke();
  });
}

function slab(kit: Kit, cam: Cam, f: Floor, st: FloorStyle): void {
  const { ctx } = kit;
  if (st.slab <= 0.001) return;
  const top = f.slab.map((p) => project(cam, p[0], p[1], st.z0));
  ctx.globalAlpha = st.slab * st.ink;
  if (f.terrace !== null) {
    edges(kit, cam, f.terrace, st.z0, 180);
    ctx.beginPath();
    tracePoly(ctx, f.terrace.map((p) => project(cam, p[0], p[1], st.z0)));
    ctx.fillStyle = kit.paper;
    ctx.fill();
    ctx.lineWidth = pen(kit, 'medium');
    ctx.stroke();
  }
  edges(kit, cam, f.slab, st.z0, st.slabMm);
  // The floor plate: paper, with the stair void cut out so the storey below shows through.
  ctx.globalAlpha = st.ink * st.slab;
  ctx.beginPath();
  tracePoly(ctx, top);
  if (f.hole !== null) tracePoly(ctx, [...f.hole].reverse().map((p) => project(cam, p[0], p[1], st.z0)));
  ctx.fillStyle = kit.paper;
  ctx.fill('evenodd');
  ctx.globalAlpha = st.slab * Math.max(st.ink, 0.4);
  ctx.lineWidth = pen(kit, 'medium') * 1.3;
  ctx.stroke();
}

interface Face {
  readonly q: readonly V2[];
  readonly d: number;
  readonly shaded: boolean;
  readonly r: number;
}

function heightOf(b: Box, cut: number): number {
  return Math.min(b.h, cut);
}

function walls(kit: Kit, cam: Cam, f: Floor, st: FloorStyle): void {
  const { ctx } = kit;
  const order = f.boxes.map((b, i) => ({ b, r: boxReveal(f, st, i) }));
  const lift = st.cut * Math.cos(cam.phi);
  if (lift * cam.s > 0.3) {
    const faces: Face[] = [];
    for (const { b, r } of order) {
      if (r <= 0) continue;
      const h = heightOf(b, st.cut);
      const c = centre(b.poly);
      const sc = centre(f.slab);
      b.poly.forEach((a, i) => {
        const e = b.poly[(i + 1) % b.poly.length] ?? a;
        const n = outward(a, e, c);
        if (!facesViewer(cam.theta, n)) return;
        const q = [project(cam, a[0], a[1], st.z0), project(cam, e[0], e[1], st.z0), project(cam, e[0], e[1], st.z0 + h), project(cam, a[0], a[1], st.z0 + h)];
        // Light from the upper left: outer faces of exterior walls turned to the right take a fine hatch.
        const right = n[0] * Math.cos(cam.theta) - n[1] * Math.sin(cam.theta) > 0.5;
        const outer = b.exterior && n[0] * ((a[0] + e[0]) / 2 - sc[0]) + n[1] * ((a[1] + e[1]) / 2 - sc[1]) > 0;
        faces.push({ q, d: depth(cam.theta, (a[0] + e[0]) / 2, (a[1] + e[1]) / 2), shaded: right && outer, r });
      });
    }
    faces.sort((x, y) => y.d - x.d);
    ctx.lineWidth = pen(kit, 'fine');
    for (const face of faces) {
      ctx.globalAlpha = st.ink * face.r;
      ctx.beginPath();
      tracePoly(ctx, face.q);
      // Flat paper (the tile's mean colour) on the many small faces: the pattern fill is the GPU cost.
      ctx.fillStyle = kit.pal.paper;
      ctx.fill();
      if (face.shaded && kit.shade !== null) {
        ctx.fillStyle = kit.shade;
        ctx.fill();
      }
      ctx.globalAlpha = Math.max(0.35, st.ink) * face.r;
      ctx.stroke();
    }
  }
  // Tops: cut walls in solid poché; sills and guards (below the cut) in paper.
  for (const { b, r } of order) {
    if (r <= 0) continue;
    const top = b.poly.map((p) => project(cam, p[0], p[1], st.z0 + heightOf(b, st.cut)));
    const cut = b.kind === 'wall' || (b.h >= st.cut && st.cut > 0 && b.kind !== 'sill');
    ctx.beginPath();
    tracePoly(ctx, top);
    const fillA = (cut ? smoothFill(r) : 1) * st.ink;
    if (fillA > 0) {
      ctx.globalAlpha = fillA;
      ctx.fillStyle = cut ? kit.pal.ink : kit.paper;
      ctx.fill();
    }
    ctx.globalAlpha = Math.max(0.35, st.ink);
    ctx.lineWidth = pen(kit, cut ? 'poche' : 'fine');
    ctx.beginPath();
    tracePartial(ctx, top, r, true);
    ctx.stroke();
  }
}

const smoothFill = (r: number): number => {
  const x = Math.min(1, Math.max(0, (r - 0.55) / 0.45));
  return x * x * (3 - 2 * x);
};

/** Per floor, each box's rank among the exterior or interior boxes (drafting order), computed once. */
const RANKS = new WeakMap<Floor, { rank: number[]; ext: number }>();

function boxReveal(f: Floor, st: FloorStyle, i: number): number {
  let r = RANKS.get(f);
  if (r === undefined) {
    let e = 0;
    let n = 0;
    r = { rank: f.boxes.map((b) => (b.exterior ? e++ : n++)), ext: 0 };
    r.ext = e;
    RANKS.set(f, r);
  }
  const b = f.boxes[i];
  if (b === undefined) return 0;
  const k = r.rank[i] ?? 0;
  return b.exterior ? st.reveal('ext', k, r.ext) : st.reveal('int', k, f.boxes.length - r.ext);
}

/** Linework on the floor plane, then walls, then the glass lines sitting on the sills. */
export function drawFloor(kit: Kit, cam: Cam, f: Floor, st: FloorStyle): void {
  const { ctx } = kit;
  ctx.strokeStyle = kit.pal.ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  slab(kit, cam, f, st);
  const a = Math.max(0.35, st.ink);
  // Terrace boards belong to the plan; in the axonometric the terrace is a plain plate.
  strokeAll(kit, cam, f.deck, st.z0, a * (1 - st.slab), (i) => st.reveal('deck', i, f.deck.length));
  strokeAll(kit, cam, f.stair, st.z0, a, (i) => st.reveal('stair', i, f.stair.length));
  strokeAll(kit, cam, f.furniture, st.z0, a * 0.95, (i) => st.reveal('furn', i, f.furniture.length));
  const low = f.openings.filter((s) => (s.z ?? 0) === 0);
  strokeAll(kit, cam, low, st.z0, a, (i) => st.reveal('open', i, low.length));
  walls(kit, cam, f, st);
  const high = f.openings
    .filter((s) => (s.z ?? 0) > 0)
    .map((s) => ({ ...s, z: Math.min(s.z ?? 0, st.cut) }));
  strokeAll(kit, cam, high, st.z0, a, (i) => st.reveal('open', i + low.length, high.length + low.length));
  ctx.globalAlpha = 1;
}

/** The faint pencil underdrawing of a storey: every outline, no fills. */
export function drawUnder(kit: Kit, cam: Cam, f: Floor, alpha: number): void {
  if (alpha <= 0) return;
  const { ctx } = kit;
  ctx.strokeStyle = kit.pal.ink;
  const all: Stroke[] = [
    ...f.boxes.map((b): Stroke => ({ pts: b.poly, pen: 'hair', closed: true })),
    ...f.openings.map((s) => ({ ...s, pen: 'hair' as const, z: 0 })),
    ...f.stair,
    ...f.furniture,
  ];
  strokeAll(kit, cam, all, 0, alpha, () => 1);
  ctx.globalAlpha = 1;
}
