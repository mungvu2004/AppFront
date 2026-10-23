/**
 * The plan's ink as 2D line work, in scene metres on the floor plane.
 *
 * Every overlay the landing draws (graphite ink, blue detection, coral checks)
 * starts from these shapes, so the drawing, the "AI" layers and the built house
 * can never disagree about where a wall face or a door edge is. Wall faces come
 * from the domain's own joint solver (`resolveWallShapes`), then every piece
 * of an outline that is a seam with — or buried in — another wall is dropped,
 * which leaves the outline a draughtsman draws: both faces, joined corners,
 * no hairlines across junctions.
 *
 * Coordinates: `P2 = [x, z]`, plan `(x_mm, y_mm)` → `(x_mm / 1000, y_mm / 1000)`.
 */

import { resolveWallShapes } from '@/domain/walls/joints';
import type { Wall, WallKind } from '@/domain/walls/types';
import type { WallId } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';
import type { LandingHouse } from '@/lib/landing/types';
import type { PlanOpening, PlanWall, PresentationPlan } from '@/lib/three/present';

export type P2 = readonly [number, number];
/** A straight stroke from `a` to `b`. */
export type Seg = readonly [P2, P2];

const EPS = 1e-4;

export const mm = (value: number): number => value / 1000;
export const p2 = (pointMm: readonly number[]): P2 => [mm(pointMm[0] ?? 0), mm(pointMm[1] ?? 0)];
export const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
export const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
export const dot = (a: P2, b: P2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: P2, b: P2): number => a[0] * b[1] - a[1] * b[0];
export const dist = (a: P2, b: P2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Compass point → unit vector on the plan (north is `+y` on the drawing, as `facingVector`). */
export function compass(direction: string | undefined): P2 | null {
  switch (direction) {
    case 'north':
      return [0, 1];
    case 'east':
      return [1, 0];
    case 'south':
      return [0, -1];
    case 'west':
      return [-1, 0];
    default:
      return null;
  }
}

/** A wall's centreline frame in metres. */
export interface WallFrame {
  readonly id: string;
  readonly a: P2;
  readonly b: P2;
  readonly len: number;
  readonly dir: P2;
  /** Left normal of `dir`. */
  readonly nrm: P2;
  readonly t: number;
}

export function wallFrame(wall: PlanWall): WallFrame {
  const a = p2(wall.start);
  const b = p2(wall.end);
  const len = Math.max(dist(a, b), EPS);
  const dir: P2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  return { id: wall.id, a, b, len, dir, nrm: [-dir[1], dir[0]], t: mm(wall.thicknessMm) };
}

/** Point at distance `s` along the wall, `off` metres to its left. */
export const along = (w: WallFrame, s: number, off = 0): P2 => add(add(w.a, w.dir, s), w.nrm, off);

/** The storey the paper shows: the first level. */
export function groundLevelId(plan: PresentationPlan): string {
  return plan.levels[0]?.id ?? '';
}

export function groundWalls(plan: PresentationPlan): readonly PlanWall[] {
  const level = groundLevelId(plan);
  return plan.walls.filter((wall) => wall.levelId === level);
}

/** `[minX, minZ, maxX, maxZ]` of the ground walls' centrelines. */
export function footprint(plan: PresentationPlan): readonly [number, number, number, number] {
  const pts = groundWalls(plan).flatMap((wall) => [p2(wall.start), p2(wall.end)]);
  if (pts.length === 0) {
    return [0, 0, 1, 1];
  }
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

/** `[minX, minZ, maxX, maxZ]` of everything the sheet shows: the ground walls and the whole plot. */
export function drawingBounds(house: LandingHouse): readonly [number, number, number, number] {
  const [x0, z0, x1, z1] = footprint(house.plan);
  const plot = house.site.plot.map(p2);
  const xs = [x0, x1, ...plot.map((p) => p[0])];
  const zs = [z0, z1, ...plot.map((p) => p[1])];
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

/** Opening span along its wall, `[s0, s1]` in metres from the wall start. */
export function openingSpan(opening: PlanOpening, w: WallFrame): readonly [number, number] {
  const c = opening.relativePosition * w.len;
  const half = mm(opening.widthMm) / 2;
  return [c - half, c + half];
}

function toWall(wall: PlanWall): Wall {
  return {
    id: wall.id as WallId,
    kind: wall.kind as WallKind,
    centreline: {
      start: { x: millimetres(wall.start[0] ?? 0), y: millimetres(wall.start[1] ?? 0) },
      end: { x: millimetres(wall.end[0] ?? 0), y: millimetres(wall.end[1] ?? 0) },
    },
    thicknessMm: millimetres(wall.thicknessMm),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(wall.heightMm ?? 3000),
  };
}

function rectangle(w: WallFrame): P2[] {
  const h = w.t / 2;
  return [along(w, 0, -h), along(w, w.len, -h), along(w, w.len, h), along(w, 0, h)];
}

/** Closed outline per wall, welded at the nodes; a plain rectangle if the solver refuses. */
export function wallPolygons(walls: readonly PlanWall[]): P2[][] {
  try {
    const { shapes } = resolveWallShapes(walls.map(toWall));
    return shapes.map((shape) => shape.outline.map((pt): P2 => [mm(pt.x), mm(pt.y)]));
  } catch {
    // ponytail: unusable walls fall back to unjoined rectangles; corners show seams.
    return walls.map((wall) => rectangle(wallFrame(wall)));
  }
}

function distToSeg(p: P2, a: P2, b: P2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 < EPS * EPS ? 0 : Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, ab, t));
}

/** `'in'`, `'on'` (within 1 mm of the boundary) or `'out'`. */
function locate(p: P2, poly: readonly P2[]): 'in' | 'on' | 'out' {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as P2;
    const b = poly[j] as P2;
    if (distToSeg(p, a, b) < 1e-3) {
      return 'on';
    }
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside ? 'in' : 'out';
}

/** Parameters along `a→b` where it meets the edges or vertices of `poly`. */
function cuts(a: P2, b: P2, poly: readonly P2[], into: number[]): void {
  const d = sub(b, a);
  const l2 = dot(d, d);
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i] as P2;
    const e = poly[(i + 1) % poly.length] as P2;
    const t = dot(sub(c, a), d) / l2;
    if (distToSeg(c, a, b) < 1e-3) {
      into.push(t);
    }
    const f = sub(e, c);
    const den = cross(d, f);
    if (Math.abs(den) > EPS) {
      const u = cross(sub(c, a), f) / den;
      const v = cross(sub(c, a), d) / den;
      if (v >= -EPS && v <= 1 + EPS) {
        into.push(u);
      }
    }
  }
}

/** One wall's drawn face pieces: its outline minus seams and parts buried in other walls. */
function visibleEdges(polys: readonly P2[][], index: number): Seg[] {
  const poly = polys[index] as P2[];
  const out: Seg[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as P2;
    const b = poly[(i + 1) % poly.length] as P2;
    if (dist(a, b) < EPS) {
      continue;
    }
    const ts = [0, 1];
    polys.forEach((other, j) => j !== index && cuts(a, b, other, ts));
    const sorted = [...new Set(ts.filter((t) => t >= 0 && t <= 1).map((t) => Math.round(t * 1e6) / 1e6))].sort(
      (x, y) => x - y,
    );
    let runStart: number | null = null;
    for (let k = 0; k < sorted.length - 1; k++) {
      const t0 = sorted[k] as number;
      const t1 = sorted[k + 1] as number;
      const mid = lerp2(a, b, (t0 + t1) / 2);
      const keep = polys.every((other, j) => j === index || locate(mid, other) === 'out');
      if (keep && runStart === null) {
        runStart = t0;
      }
      if (!keep && runStart !== null) {
        out.push([lerp2(a, b, runStart), lerp2(a, b, t0)]);
        runStart = null;
      }
    }
    if (runStart !== null) {
      out.push([lerp2(a, b, runStart), b]);
    }
  }
  return out;
}

/** Remove `[s0, s1]` intervals (along the wall) from the strokes that run along it. */
export function cutAlong(segs: readonly Seg[], w: WallFrame, gaps: readonly (readonly [number, number])[]): Seg[] {
  const out: Seg[] = [];
  for (const seg of segs) {
    const d = sub(seg[1], seg[0]);
    if (Math.abs(cross(d, w.dir)) > 1e-3 * Math.max(1, Math.hypot(d[0], d[1]))) {
      out.push(seg);
      continue;
    }
    const sa = dot(sub(seg[0], w.a), w.dir);
    const sb = dot(sub(seg[1], w.a), w.dir);
    const off = dot(sub(seg[0], w.a), w.nrm);
    let pieces: (readonly [number, number])[] = [[Math.min(sa, sb), Math.max(sa, sb)]];
    for (const [g0, g1] of gaps) {
      pieces = pieces.flatMap(([p0, p1]) =>
        g1 <= p0 || g0 >= p1
          ? [[p0, p1] as const]
          : ([
              [p0, g0],
              [g1, p1],
            ] as const).filter(([x, y]) => y - x > EPS),
      );
    }
    pieces.forEach(([p0, p1]) => out.push([along(w, p0, off), along(w, p1, off)]));
  }
  return out;
}

/** Drawn wall faces per ground wall id, openings left open. */
export function wallFaces(plan: PresentationPlan): Map<string, Seg[]> {
  const walls = groundWalls(plan);
  const polys = wallPolygons(walls);
  const faces = new Map<string, Seg[]>();
  walls.forEach((wall, index) => {
    const w = wallFrame(wall);
    const spans = plan.openings.filter((o) => o.wallId === wall.id).map((o) => openingSpan(o, w));
    faces.set(wall.id, cutAlong(visibleEdges(polys, index), w, spans));
  });
  return faces;
}

/** Points on a circular arc around `c`, from `from` turning `sweep` radians. */
export function arc(c: P2, radius: number, from: number, sweep: number, steps = 16): P2[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = from + (sweep * i) / steps;
    return [c[0] + Math.cos(angle) * radius, c[1] + Math.sin(angle) * radius] as P2;
  });
}

export const circle = (c: P2, radius: number, steps = 32): P2[] => arc(c, radius, 0, Math.PI * 2, steps);

/** Dashes along `a→b`: alternating on/off lengths from `pattern`, starting at `a`. */
export function dashes(a: P2, b: P2, pattern: readonly number[]): Seg[] {
  const len = dist(a, b);
  const out: Seg[] = [];
  let s = 0;
  let k = 0;
  while (s < len && pattern.length > 0) {
    const step = pattern[k % pattern.length] as number;
    if (k % 2 === 0) {
      out.push([lerp2(a, b, s / len), lerp2(a, b, Math.min(len, s + step) / len)]);
    }
    s += step;
    k += 1;
  }
  return out;
}
