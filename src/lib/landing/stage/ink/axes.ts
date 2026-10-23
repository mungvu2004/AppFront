/**
 * Structural grid and dimension chains (scene 02), from `house.axes`.
 *
 * Grid lines are dash-dot and grow out of their bubbles; dimensions reveal
 * one after another with slightly uneven delays, extension lines first, then
 * the line, then the ticks. Letters and numbers are DOM labels, so this module
 * only publishes where they go: `axis:<id>` at a bubble's centre and
 * `dim:<mm>` just outside a dimension line's midpoint.
 */

import type { LandingHouse } from '@/lib/landing/types';

import { add, circle, dashes, footprint, mm, type P2 } from './geometry';
import { flatStroke, GRAPHITE, lineMaterial, RevealLine, windows, type P3, type Stroke } from './lines';

/** Bubbles and dimension chains clear the planting bed along the house front. */
const AXIS_REACH_M = 2.6;
const BUBBLE_R = 0.28;
const DASH_DOT = [0.45, 0.09, 0.04, 0.09];
/** Architectural 45° tick, the same slant on every dimension. */
const SLASH: P2 = [Math.SQRT1_2, -Math.SQRT1_2];

export interface Grid {
  readonly axes: RevealLine;
  readonly dims: RevealLine;
  /** Anchor id → position on the drawing plane (y = 0). */
  readonly anchors: ReadonlyMap<string, P3>;
}

/** Axis positions along each direction, falling back to the footprint. */
function stations(house: LandingHouse): { xs: number[]; zs: number[] } {
  const [minX, minZ, maxX, maxZ] = footprint(house.plan);
  const pick = (along: 'x' | 'y', lo: number, hi: number): number[] => {
    const values = house.axes.filter((axis) => axis.along === along).map((axis) => mm(axis.atMm));
    return values.length >= 2 ? [...values].sort((a, b) => a - b) : [lo, hi];
  };
  return { xs: pick('x', minX, maxX), zs: pick('y', minZ, maxZ) };
}

function axisStrokes(house: LandingHouse, anchors: Map<string, P3>): Stroke[] {
  const { xs, zs } = stations(house);
  const x0 = xs[0] as number;
  const z0 = zs[0] as number;
  const x1 = xs[xs.length - 1] as number;
  const z1 = zs[zs.length - 1] as number;
  const slot = windows(house.axes.length, 0, 1, 0.45);
  const out: Stroke[] = [];
  house.axes.forEach((axis, i) => {
    const [start, end] = slot(i);
    const at = mm(axis.atMm);
    const vertical = axis.along === 'x';
    const bubble: P2 = vertical ? [at, z0 - AXIS_REACH_M - BUBBLE_R] : [x0 - AXIS_REACH_M - BUBBLE_R, at];
    const from: P2 = vertical ? [at, z0 - AXIS_REACH_M] : [x0 - AXIS_REACH_M, at];
    const to: P2 = vertical ? [at, z1 + 0.6] : [x1 + 0.6, at];
    anchors.set(`axis:${axis.id}`, [bubble[0], 0, bubble[1]]);

    const mid = start + (end - start) * 0.3;
    out.push({ pts: flatStroke(circle(bubble, BUBBLE_R, 28)), start, end: mid });
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    for (const seg of dashes(from, to, DASH_DOT)) {
      const s0 = Math.hypot(seg[0][0] - from[0], seg[0][1] - from[1]) / len;
      const s1 = Math.hypot(seg[1][0] - from[0], seg[1][1] - from[1]) / len;
      out.push({ pts: flatStroke([seg[0], seg[1]]), start: mid + (end - mid) * s0, end: mid + (end - mid) * s1 });
    }
  });
  return out;
}

interface Dim {
  readonly a: P2;
  readonly b: P2;
  /** Unit vector from the building out to the dimension line. */
  readonly out: P2;
  /** Distance from the dimension line back to where extension lines start. */
  readonly reach: number;
}

function dimStrokes(house: LandingHouse, anchors: Map<string, P3>): Stroke[] {
  const { xs, zs } = stations(house);
  const x0 = xs[0] as number;
  const x1 = xs[xs.length - 1] as number;
  const z0 = zs[0] as number;
  const z1 = zs[zs.length - 1] as number;
  const chainZ = z0 - 1.25;
  const overallZ = z0 - 1.8;
  const sideX = x0 - 0.95;
  const dims: Dim[] = [
    ...xs.slice(1).map((x, i): Dim => ({ a: [xs[i] as number, chainZ], b: [x, chainZ], out: [0, -1], reach: 0.95 })),
    { a: [x0, overallZ], b: [x1, overallZ], out: [0, -1], reach: 1.5 },
    { a: [sideX, z0], b: [sideX, z1], out: [-1, 0], reach: 0.7 },
  ];

  const seen = new Map<string, number>();
  const out: Stroke[] = [];
  dims.forEach((dim, i) => {
    // Uneven, deterministic delays: precise, but not a metronome.
    const start = (0.78 * i) / Math.max(1, dims.length - 1) + (((i * 37) % 5) - 2) * 0.012;
    const s = Math.max(0, start);
    const dur = 0.2;
    const e = Math.min(1, s + dur);
    const tick = 0.09;
    for (const p of [dim.a, dim.b]) {
      out.push({ pts: flatStroke([add(p, dim.out, -dim.reach), add(p, dim.out, 0.12)]), start: s, end: s + dur * 0.35 });
      out.push({ pts: flatStroke([add(p, SLASH, -tick), add(p, SLASH, tick)]), start: s + dur * 0.8, end: e });
    }
    out.push({ pts: flatStroke([dim.a, dim.b]), start: s + dur * 0.25, end: s + dur * 0.85 });

    const value = Math.round(Math.hypot(dim.b[0] - dim.a[0], dim.b[1] - dim.a[1]) * 1000);
    const count = (seen.get(String(value)) ?? 0) + 1;
    seen.set(String(value), count);
    const label = add([(dim.a[0] + dim.b[0]) / 2, (dim.a[1] + dim.b[1]) / 2], dim.out, 0.16);
    anchors.set(count === 1 ? `dim:${value}` : `dim:${value}-${count}`, [label[0], 0, label[1]]);
  });
  return out;
}

export function createGrid(house: LandingHouse): Grid {
  const anchors = new Map<string, P3>();
  return {
    axes: new RevealLine('ink:axes', axisStrokes(house, anchors), lineMaterial(GRAPHITE, 0.9)),
    dims: new RevealLine('ink:dims', dimStrokes(house, anchors), lineMaterial(GRAPHITE, 0.9)),
    anchors,
  };
}
