/**
 * The villa as drawing primitives for the blueprint prototype, per storey, in plan mm (north = +y).
 *
 * Walls become solid boxes between their openings (cut walls), windows leave a sill box and glass
 * lines, doors leave a leaf and a swing arc on the floor. Furniture becomes plan symbols (outline +
 * one telling detail), the U-stair becomes treads and a walk line. Everything is read from
 * `LANDING_HOUSE`, so the drawing and the 3D product share one dataset.
 */

import { LANDING_HOUSE } from '@/lib/landing/house';
import type { PlanFurniture, PlanOpening, PlanWall } from '@/lib/three/present';

export type V2 = readonly [number, number];

/** A vertical prism: plan polygon extruded from z 0 to `h` (cut walls, sills, rails). */
export interface Box {
  readonly poly: readonly V2[];
  readonly h: number;
  readonly kind: 'wall' | 'sill' | 'rail';
  readonly exterior: boolean;
}

/** A line on the floor plane (or at height `z`), drawn with one of the pen weights. */
export interface Stroke {
  readonly pts: readonly V2[];
  readonly pen: 'medium' | 'fine' | 'hair';
  readonly closed?: boolean;
  readonly dashed?: boolean;
  readonly z?: number;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly m2: number;
  readonly at: V2;
  readonly tag: string;
}

export interface Floor {
  readonly id: string;
  readonly boxes: readonly Box[];
  readonly openings: readonly Stroke[];
  readonly furniture: readonly Stroke[];
  readonly stair: readonly Stroke[];
  readonly deck: readonly Stroke[];
  readonly rooms: readonly Room[];
  /** Slab outline (outer face of the exterior walls) and the stair void, if any. */
  readonly slab: readonly V2[];
  readonly hole: readonly V2[] | null;
  /** The rear terrace plate on the ground floor. */
  readonly terrace: readonly V2[] | null;
  readonly m2: number;
}

const house = LANDING_HOUSE;
const HALF_EXT = 110;

const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function frame(w: PlanWall): { a: V2; d: V2; n: V2; len: number } {
  const a: V2 = [w.start[0] ?? 0, w.start[1] ?? 0];
  const dx = (w.end[0] ?? 0) - a[0];
  const dy = (w.end[1] ?? 0) - a[1];
  const len = Math.hypot(dx, dy);
  const d: V2 = [dx / len, dy / len];
  return { a, d, n: [-d[1], d[0]], len };
}

/** Plan point `along` the wall's centreline and `across` it. */
function onWall(w: PlanWall, along: number, across: number): V2 {
  const { a, d, n } = frame(w);
  return [a[0] + d[0] * along + n[0] * across, a[1] + d[1] * along + n[1] * across];
}

function band(w: PlanWall, from: number, to: number): V2[] {
  const h = w.thicknessMm / 2;
  return [onWall(w, from, -h), onWall(w, to, -h), onWall(w, to, h), onWall(w, from, h)];
}

function wallBoxes(w: PlanWall, ops: readonly PlanOpening[]): Box[] {
  const { len } = frame(w);
  const half = w.thicknessMm / 2;
  const kind = w.kind === 'railing' ? 'rail' : 'wall';
  const h = w.kind === 'railing' ? (w.heightMm ?? 1050) : Number.POSITIVE_INFINITY;
  const exterior = w.thicknessMm >= 200;
  const cuts = ops
    .map((o) => ({ o, c: o.relativePosition * len }))
    .sort((p, q) => p.c - q.c)
    .map(({ o, c }) => ({ o, from: c - o.widthMm / 2, to: c + o.widthMm / 2 }));
  const out: Box[] = [];
  let at = kind === 'rail' ? 0 : -half;
  for (const cut of cuts) {
    if (cut.from > at + 1) out.push({ poly: band(w, at, cut.from), h, kind, exterior });
    if (cut.o.kind === 'window' && cut.o.sillHeightMm > 0) {
      out.push({ poly: band(w, cut.from, cut.to), h: cut.o.sillHeightMm, kind: 'sill', exterior });
    }
    at = cut.to;
  }
  const end = kind === 'rail' ? len : len + half;
  if (end > at + 1) out.push({ poly: band(w, at, end), h, kind, exterior });
  return out;
}

const COMPASS: Record<string, V2> = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };

function arc(c: V2, r: number, a0: number, a1: number, steps = 18): V2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = a0 + ((a1 - a0) * i) / steps;
    return [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r] as V2;
  });
}

function openingStrokes(o: PlanOpening, w: PlanWall): Stroke[] {
  const { len, d, n } = frame(w);
  const c = o.relativePosition * len;
  const from = c - o.widthMm / 2;
  const to = c + o.widthMm / 2;
  const h = w.thicknessMm / 2;
  if (o.kind === 'window') {
    const z = o.sillHeightMm;
    const glass = [-h * 0.35, h * 0.35].map((k): Stroke => ({ pts: [onWall(w, from, k), onWall(w, to, k)], pen: 'hair', z }));
    const jambs = [from, to].map((s): Stroke => ({ pts: [onWall(w, s, -h), onWall(w, s, h)], pen: 'fine', z }));
    const mullion: Stroke[] = o.swing === 'sliding' ? [{ pts: [onWall(w, c, -h), onWall(w, c, h)], pen: 'hair', z }] : [];
    return [...glass, ...jambs, ...mullion];
  }
  if (o.kind !== 'door') return [{ pts: [onWall(w, from, h), onWall(w, to, h)], pen: 'hair', dashed: true }];
  const side = COMPASS[o.opensTowards ?? 'north'] ?? [0, 1];
  const sign = Math.sign(side[0] * n[0] + side[1] * n[1]) || 1;
  const hinge = onWall(w, from, sign * h);
  const leaf: V2 = [hinge[0] + n[0] * sign * o.widthMm, hinge[1] + n[1] * sign * o.widthMm];
  const a0 = Math.atan2(d[1], d[0]);
  const a1 = Math.atan2(n[1] * sign, n[0] * sign);
  let delta = a1 - a0;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return [
    { pts: [hinge, leaf], pen: 'medium' },
    { pts: arc(hinge, o.widthMm, a0, a0 + delta), pen: 'hair' },
  ];
}

/** Local frame of a piece: `u` to its right, `v` towards its front. */
function piece(f: PlanFurniture): { at: (x: number, y: number) => V2; w: number; d: number } {
  const v = COMPASS[f.facing] ?? [0, 1];
  const u: V2 = [v[1], -v[0]];
  const c: V2 = [f.centreMm[0] ?? 0, f.centreMm[1] ?? 0];
  return {
    at: (x, y) => [c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y],
    w: f.sizeMm[0] ?? 0,
    d: f.sizeMm[1] ?? 0,
  };
}

function furnitureStrokes(f: PlanFurniture): Stroke[] {
  const slug = /items\/([^/]+)\//.exec(f.modelUrl ?? '')?.[1] ?? f.variant;
  if (slug === 'picture' || slug === 'television') return [];
  const { at, w, d } = piece(f);
  const box = (x0: number, y0: number, x1: number, y1: number, pen: Stroke['pen'] = 'fine', dashed = false): Stroke => ({
    pts: [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)],
    pen,
    closed: true,
    dashed,
  });
  const ring = (cx: number, cy: number, rx: number, ry: number, pen: Stroke['pen'] = 'hair'): Stroke => ({
    pts: Array.from({ length: 25 }, (_, i) => at(cx + Math.cos((i / 24) * 2 * Math.PI) * rx, cy + Math.sin((i / 24) * 2 * Math.PI) * ry)),
    pen,
    closed: true,
  });
  const line = (x0: number, y0: number, x1: number, y1: number): Stroke => ({ pts: [at(x0, y0), at(x1, y1)], pen: 'hair' });
  const W = w / 2;
  const D = d / 2;
  if ((f.liftMm ?? 0) >= 1500) return [box(-W, -D, W, D, 'hair', true)];
  switch (slug) {
    case 'sofa':
    case 'livingroom-chair':
    case 'lounge-chair':
      return [box(-W, -D, W, D), line(-W, -D + d * 0.28, W, -D + d * 0.28), line(-W + 160, -D + d * 0.28, -W + 160, D), line(W - 160, -D + d * 0.28, W - 160, D)];
    case 'double-bed':
    case 'single-bed': {
      const pillows = slug === 'double-bed' ? [box(-W + 90, -D + 80, -40, -D + 420, 'hair'), box(40, -D + 80, W - 90, -D + 420, 'hair')] : [box(-W + 90, -D + 80, W - 90, -D + 420, 'hair')];
      return [box(-W, -D, W, D), ...pillows, line(-W, -D + d * 0.38, W, -D + d * 0.38), line(-W, -D + d * 0.38, W * 0.2, D)];
    }
    case 'rectangular-carpet':
      return [box(-W, -D, W, D, 'hair', true)];
    case 'round-carpet':
      return [{ ...ring(0, 0, W, D), dashed: true }];
    case 'toilet':
      return [box(-W, -D, W, -D + d * 0.28), ring(0, d * 0.12, W * 0.85, D * 0.62, 'fine')];
    case 'bathtub':
      return [box(-W, -D, W, D), box(-W + 90, -D + 90, W - 90, D - 90, 'hair')];
    case 'bathroom-sink':
      return [box(-W, -D, W, D), ring(-W * 0.45, 0, W * 0.2, D * 0.55), ring(W * 0.45, 0, W * 0.2, D * 0.55)];
    case 'shower-square':
      return [box(-W, -D, W, D), line(-W, -D, W, D), line(-W, D, W, -D)];
    case 'stove':
      return [box(-W, -D, W, D), ring(-W / 2, -D / 2, 110, 110), ring(W / 2, -D / 2, 110, 110), ring(-W / 2, D / 2, 90, 90), ring(W / 2, D / 2, 90, 90)];
    case 'closet':
    case 'bookshelf':
      return [box(-W, -D, W, D), line(-W, 0, W, 0)];
    case 'indoor-plant':
    case 'small-indoor-plant':
      return [ring(0, 0, W * 0.5, W * 0.5, 'fine'), ...[0, 1, 2, 3, 4].map((k) => line(0, 0, Math.cos(k * 1.26) * W * 0.42, Math.sin(k * 1.26) * W * 0.42))];
    case 'floor-lamp':
    case 'ceiling-lamp':
      return [ring(0, 0, W * 0.4, W * 0.4), line(-W * 0.4, 0, W * 0.4, 0), line(0, -W * 0.4, 0, W * 0.4)];
    case 'kitchen':
    case 'kitchen-counter':
      return [box(-W, -D, W, D), line(-W, D - 50, W, D - 50)];
    default:
      return [box(-W, -D, W, D)];
  }
}

function stairStrokes(levelId: string): Stroke[] {
  const s = levelId === 'T1' ? house.stair : house.topStair;
  if (s === undefined || s.levelId !== levelId) return [];
  const half = s.widthMm / 2;
  const [x, y0] = s.startMm;
  const n = s.landing?.afterRisers ?? s.risers;
  const run = s.treadMm;
  const top = y0 + (n - 1) * run;
  const back = x - s.widthMm - (s.landing?.gapMm ?? 0);
  const out: Stroke[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ pts: [[x - half, y0 + i * run], [x + half, y0 + i * run]], pen: 'fine' });
    out.push({ pts: [[back - half, y0 + i * run], [back + half, y0 + i * run]], pen: 'fine' });
  }
  const land = top + (s.landing?.depthMm ?? 0);
  out.push({ pts: rect(back - half, y0, x + half, land), pen: 'fine', closed: true });
  out.push({ pts: [[x, y0 + 200], [x, top + 600], [back, top + 600], [back, y0 + 300]], pen: 'hair' });
  out.push({ pts: [[back - 120, y0 + 520], [back, y0 + 300], [back + 120, y0 + 520]], pen: 'hair' });
  return out;
}

function centroid(outline: readonly (readonly number[])[]): V2 {
  const k = outline.length;
  return [outline.reduce((s, p) => s + (p[0] ?? 0), 0) / k, outline.reduce((s, p) => s + (p[1] ?? 0), 0) / k];
}

const SLAB: Record<string, { box: V2[]; hole: V2[] | null; m2: number }> = {
  T1: { box: rect(4000 - HALF_EXT, 9000 - HALF_EXT, 28000 + HALF_EXT, 21000 + HALF_EXT), hole: null, m2: 288 },
  T2: { box: rect(4000 - HALF_EXT, 9000 - HALF_EXT, 22000 + HALF_EXT, 23000 + HALF_EXT), hole: rect(13200, 11000, 16000, 14360), m2: 252 },
  T3: { box: rect(12000 - HALF_EXT, 9000 - HALF_EXT, 20000 + HALF_EXT, 16000 + HALF_EXT), hole: rect(13200, 11000, 16000, 14360), m2: 56 },
};

function deckStrokes(levelId: string): Stroke[] {
  if (levelId !== 'T1') return [];
  const out: Stroke[] = [{ pts: rect(4000, 21110, 28000, 25000), pen: 'fine', closed: true }];
  for (let y = 21400; y < 25000; y += 300) out.push({ pts: [[4000, y], [28000, y]], pen: 'hair' });
  return out;
}

function buildFloor(levelId: string, index: number): Floor {
  const plan = house.plan;
  const walls = plan.walls.filter((w) => w.levelId === levelId);
  const boxes: Box[] = [];
  const openings: Stroke[] = [];
  for (const w of walls) {
    const ops = plan.openings.filter((o) => o.wallId === w.id);
    boxes.push(...wallBoxes(w, ops));
    for (const o of ops) openings.push(...openingStrokes(o, w));
  }
  const furniture = plan.furniture.filter((f) => (f.levelId ?? 'T1') === levelId).flatMap(furnitureStrokes);
  let tag = 0;
  const rooms: Room[] = [];
  for (const info of house.rooms) {
    const r = plan.rooms.find((x) => x.id === info.roomId);
    if (r === undefined || r.levelId !== levelId) continue;
    tag += 1;
    rooms.push({ id: r.id, name: info.name, m2: info.statedAreaM2, at: centroid(r.outline), tag: `${String(index + 1)}.${String(tag).padStart(2, '0')}` });
  }
  const slab = SLAB[levelId] ?? { box: [], hole: null, m2: 0 };
  const terrace = levelId === 'T1' ? rect(4000, 21110, 28000, 25000) : null;
  return { id: levelId, boxes, openings, furniture, stair: stairStrokes(levelId), deck: deckStrokes(levelId), rooms, slab: slab.box, hole: slab.hole, terrace, m2: slab.m2 };
}

export const FLOORS: readonly Floor[] = house.plan.levels.map((l, i) => buildFloor(l.id, i));

export const AXES = house.axes;

/** Counts the AI reads off the ground floor, for the margin note. */
export const T1_COUNTS = (() => {
  const t1 = FLOORS[0];
  const doors = house.plan.openings.filter((o) => o.kind === 'door' && house.plan.walls.some((w) => w.id === o.wallId && w.levelId === 'T1'));
  return {
    rooms: t1?.rooms.length ?? 0,
    doors: doors.length,
    walls: house.plan.walls.filter((w) => w.levelId === 'T1').length,
  };
})();

export const wallOf = (id: string): PlanWall | undefined => house.plan.walls.find((w) => w.id === id);
export const openingOf = (id: string): PlanOpening | undefined => house.plan.openings.find((o) => o.id === id);

/** Centre of an opening in plan mm. */
export function openingCentre(id: string): V2 {
  const o = openingOf(id);
  const w = o === undefined ? undefined : wallOf(o.wallId);
  if (o === undefined || w === undefined) return [0, 0];
  return onWall(w, o.relativePosition * frame(w).len, 0);
}
