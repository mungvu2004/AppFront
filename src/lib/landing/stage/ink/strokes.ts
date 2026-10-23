/**
 * The architectural ink of scene 01: walls, openings, the void and the stair,
 * plus the "junk" ink (notes, north arrow) the AI later ignores.
 *
 * The walls (outline + poché) are the drawing the page opens on, complete.
 * `state.paper.ink` then draws the fine layers in a draughtsman's order —
 * openings, the stair, furniture symbols — each stroke revealed along its
 * length (see `lines.ts`), never faded in as a whole plan.
 */

import type { LandingHouse } from '@/lib/landing/types';

import {
  add,
  arc,
  circle,
  compass,
  dashes,
  dist,
  drawingBounds,
  along,
  groundWalls,
  openingSpan,
  wallFaces,
  wallFrame,
  type P2,
  type Seg,
} from './geometry';
import { flatStroke, GRAPHITE, lineMaterial, RevealLine, windows, type Stroke } from './lines';
import { stairPlan } from './stairPlan';
import { furnitureSymbols } from './symbols';

/** Leaf, swing arc, glazing lines, dashed head: everything an opening adds to the plan. */
export function openingStrokes(house: LandingHouse): P2[][] {
  const out: P2[][] = [];
  const walls = new Map(groundWalls(house.plan).map((wall) => [wall.id, wallFrame(wall)]));
  for (const opening of house.plan.openings) {
    const w = walls.get(opening.wallId);
    if (!w) {
      continue;
    }
    const [s0, s1] = openingSpan(opening, w);
    const h = w.t / 2;
    out.push([along(w, s0, -h), along(w, s0, h)], [along(w, s1, -h), along(w, s1, h)]);

    if (opening.kind === 'window') {
      for (const off of [-h, 0, h]) {
        out.push([along(w, s0, off), along(w, s1, off)]);
      }
      continue;
    }
    if (opening.kind === 'void') {
      dashes(along(w, s0), along(w, s1), [0.16, 0.08]).forEach((seg) => out.push([seg[0], seg[1]]));
      continue;
    }
    if (opening.swing === 'sliding') {
      const span = s1 - s0;
      out.push([along(w, s0, h / 3), along(w, s0 + span * 0.55, h / 3)]);
      out.push([along(w, s1 - span * 0.55, -h / 3), along(w, s1, -h / 3)]);
      continue;
    }
    if (opening.swing === 'fixed') {
      continue;
    }
    const target = compass(opening.opensTowards);
    const side = target && target[0] * w.nrm[0] + target[1] * w.nrm[1] < 0 ? -1 : 1;
    const leaves: [number, number][] =
      opening.swing === 'double'
        ? [
            [s0, 1],
            [s1, -1],
          ]
        : [opening.swing === 'left' ? [s0, 1] : [s1, -1]];
    const leafLength = (s1 - s0) / leaves.length;
    for (const [s, free] of leaves) {
      const hinge = along(w, s, side * h);
      const open = add(hinge, w.nrm, side * leafLength);
      const closedAngle = Math.atan2(w.dir[1] * free, w.dir[0] * free);
      const openAngle = Math.atan2(w.nrm[1] * side, w.nrm[0] * side);
      let sweep = openAngle - closedAngle;
      sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
      out.push([hinge, open], arc(hinge, leafLength, closedAngle, sweep, 14));
    }
  }
  return out;
}

/** Nosing lines, the flight sides and landing, and the climb arrow. */
export function stairStrokes(house: LandingHouse): P2[][] {
  const plan = stairPlan(house.stair);
  return [...plan.edges, ...plan.risers.map((r): P2[] => [r.a, r.b]), ...plan.climb];
}

/** A few handwritten-looking note lines and a north arrow in the right margin. */
export function junkStrokes(house: LandingHouse): P2[][] {
  const [, minZ, maxX] = drawingBounds(house);
  const out: P2[][] = [];
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let row = 0; row < 3; row++) {
    let x = maxX + 0.9;
    const z = minZ + 1.2 + row * 0.42;
    const end = x + 1.3 + rand() * 0.6;
    while (x < end) {
      const word = 0.18 + rand() * 0.32;
      const pts: P2[] = [];
      for (let s = 0; s <= word; s += 0.025) {
        pts.push([x + s, z + Math.sin(s * 70 + row) * 0.035 * (0.6 + rand() * 0.4) - s * 0.02]);
      }
      out.push(pts);
      x += word + 0.1;
    }
  }
  const c: P2 = [maxX + 1.6, minZ + 3.4];
  const r = 0.32;
  out.push(circle(c, r, 28));
  out.push([add(c, [0, -1], r * 1.3), add(c, [0, 1], r * 1.3)]);
  out.push([add(c, [-0.12, 1], r * 0.75), add(c, [0, 1], r * 1.3), add(c, [0.12, 1], r * 0.75)]);
  const n0: P2 = add(c, [0, 1], r * 1.55);
  out.push([add(n0, [-0.07, 0]), add(n0, [-0.07, 0.16]), add(n0, [0.07, 0]), add(n0, [0.07, 0.16])]);
  return out;
}

export interface Strokes {
  readonly walls: RevealLine;
  readonly openings: RevealLine;
  readonly stair: RevealLine;
  readonly junk: RevealLine;
  readonly furniture: RevealLine;
  /** Every drawn wall face, by wall id — the detection layer reuses them. */
  readonly faces: ReadonlyMap<string, Seg[]>;
}

function timed(polylines: readonly (readonly P2[])[], a: number, b: number, share?: number): Stroke[] {
  const slot = windows(polylines.length, a, b, share);
  return polylines.map((pts, i) => {
    const [start, end] = slot(i);
    return { pts: flatStroke(pts), start, end };
  });
}

export function createStrokes(house: LandingHouse): Strokes {
  const faces = wallFaces(house.plan);
  const wallLines = [...faces.values()]
    .flat()
    .map((seg): P2[] => [seg[0], seg[1]])
    .sort((x, y) => dist(y[0] as P2, y[1] as P2) - dist(x[0] as P2, x[1] as P2));
  const walls = new RevealLine('ink:walls', timed(wallLines, 0, 0, 0), lineMaterial(GRAPHITE, 1.5));
  walls.reveal(1);
  return {
    faces,
    // Walls are the complete drawing from the first frame; `paper.ink` draws only the fine layers.
    walls,
    openings: new RevealLine('ink:openings', timed(openingStrokes(house), 0, 0.42, 0.18), lineMaterial(GRAPHITE, 0.9)),
    stair: new RevealLine('ink:stair', timed(stairStrokes(house), 0.36, 0.58, 0.3), lineMaterial(GRAPHITE, 0.9)),
    furniture: new RevealLine(
      'ink:furniture',
      timed(furnitureSymbols(house.plan).flat(), 0.5, 1, 0.08),
      lineMaterial(GRAPHITE, 0.8),
    ),
    junk: new RevealLine('ink:junk', timed(junkStrokes(house), 0.55, 1, 0.2), lineMaterial(GRAPHITE, 1)),
  };
}
