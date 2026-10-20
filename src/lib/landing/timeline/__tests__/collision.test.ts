/** @vitest-environment node */
/**
 * The camera never passes through architecture: sampled densely, no sample is
 * inside a ground-floor wall slab (at its current height: risen and cut away as
 * the stage draws it, inflated by the 0.25 m clearance) unless it sits in the
 * clearance tunnel of a door or void in that wall; none is inside the stair or,
 * while it exists, the upper storey's block at its current lift; none is within
 * 0.3 m of a furniture piece (upper pieces lifted with their storey), so the near
 * plane never cuts into one. Samples below 4 m are < 0.3 m apart, so no step can
 * hop across a 0.61 m inflated slab. Checked for 16:10, 4:3 and portrait 3:4.
 */
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '../../house';
import { cameraAt, stateAt } from '..';

const CLEAR = 0.25;
const WALL_H = 3;
const plan = LANDING_HOUSE.plan;

const slabs = plan.walls
  .filter((w) => w.levelId === 'T1')
  .map((w) => {
    const [ax = 0, az = 0] = w.start.map((v) => v / 1000);
    const [bx = 0, bz = 0] = w.end.map((v) => v / 1000);
    const len = Math.hypot(bx - ax, bz - az);
    const holes = plan.openings
      .filter((o) => o.wallId === w.id && o.kind !== 'window')
      .map((o) => ({
        id: o.id,
        from: o.relativePosition * len - o.widthMm / 2000 + CLEAR,
        to: o.relativePosition * len + o.widthMm / 2000 - CLEAR,
        top: (o.sillHeightMm + o.heightMm) / 1000 - CLEAR,
      }));
    return { id: w.id, ax, az, ux: (bx - ax) / len, uz: (bz - az) / len, len, half: w.thicknessMm / 2000, holes };
  });

/** Which wall (if any) the point collides with; `heightOf` gives a wall's current height. */
function hit([x, y, z]: readonly number[], heightOf: (id: string) => number = () => WALL_H): string | null {
  for (const s of slabs) {
    if ((y ?? 0) >= heightOf(s.id) + CLEAR) continue;
    const dx = (x ?? 0) - s.ax;
    const dz = (z ?? 0) - s.az;
    const along = dx * s.ux + dz * s.uz;
    const across = Math.abs(dx * -s.uz + dz * s.ux);
    if (across > s.half + CLEAR || along < -CLEAR - s.half || along > s.len + CLEAR + s.half) continue;
    const inHole = s.holes.some((h) => along >= h.from && along <= h.to && (y ?? 0) <= h.top);
    if (!inHole) return s.id;
  }
  return null;
}

const NEAR = 0.3;
const pieces = plan.furniture.map((f) => {
  const sideways = f.facing === 'east' || f.facing === 'west';
  const [w = 0, d = 0, h = 0] = f.sizeMm.map((v) => v / 1000);
  const [cx = 0, cz = 0] = f.centreMm.map((v) => v / 1000);
  const [hx, hz] = sideways ? [d / 2, w / 2] : [w / 2, d / 2];
  return { id: f.id, upper: f.levelId !== 'T1', lo: [cx - hx, 0, cz - hz], hi: [cx + hx, h, cz + hz] };
});

/** Distance from a point to an axis-aligned box (0 inside). */
const boxDist = (q: readonly number[], lo: readonly number[], hi: readonly number[]): number =>
  Math.hypot(...q.map((v, i) => Math.max((lo[i] ?? 0) - v, 0, v - (hi[i] ?? 0))));

const inBox = (q: readonly number[], lo: readonly number[], hi: readonly number[]): boolean =>
  q.every((v, i) => v > (lo[i] ?? 0) - CLEAR && v < (hi[i] ?? 0) + CLEAR);

describe('camera path collision', () => {
  it.each([
    [16 / 10, 2e-4],
    [4 / 3, 2e-4],
    [3 / 4, 2e-4],
  ])('passes only through openings with clearance at aspect %d', (aspect, STEP) => {
    const bad: string[] = [];
    let prev = cameraAt(0, aspect).position;
    const stair = LANDING_HOUSE.stair;
    const sx = stair.startMm[0] / 1000;
    const sz = stair.startMm[1] / 1000;
    const run = ((stair.risers - 1) * stair.treadMm) / 1000;
    for (let k = 0; k <= 1 / STEP; k += 1) {
      const p = k * STEP;
      const c = cameraAt(p, aspect).position;
      // Only near the walls can a long step hop across one.
      if (Math.min(c[1], prev[1]) < WALL_H + 1) expect(Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])).toBeLessThan(0.3);
      prev = c;
      const b = stateAt(p).build;
      const cut = WALL_H + (1.2 - WALL_H) * b.cutaway;
      const wall = hit(c, (id) => Math.min(WALL_H * (b.wallRise[id] ?? 0), cut));
      const at = `p=${p.toFixed(4)} (${c.map((v) => v.toFixed(2)).join(',')})`;
      if (wall !== null) bad.push(`${at} in ${wall}`);
      const w = stair.widthMm / 2000;
      if (b.stair > 0 && inBox(c, [sx - w, 0, sz], [sx + w, 3, sz + run])) bad.push(`${at} in stair`);
      const lift = 3 + b.upperLiftM;
      if (b.upper > 0 && inBox(c, [-0.11, lift - 0.2, -0.11], [8.11, lift + 3, 9.11])) {
        bad.push(`${at} in upper storey (lift ${b.upperLiftM.toFixed(2)})`);
      }
      for (const f of pieces) {
        const dy = f.upper ? lift : 0;
        const grown = (b.furniture[f.id] ?? 0) > 0 && (!f.upper || b.upper > 0);
        if (grown && boxDist(c, [f.lo[0] ?? 0, dy, f.lo[2] ?? 0], [f.hi[0] ?? 0, (f.hi[1] ?? 0) + dy, f.hi[2] ?? 0]) < NEAR) {
          bad.push(`${at} near ${f.id}`);
        }
      }
      if (c[1] < 0.5) bad.push(`${at} below eye floor`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('flags a path through a wall (the check itself works)', () => {
    expect(hit([5, 1.5, 4])).toBe('W8');
    expect(hit([5, 1.5, 1.5])).toBeNull(); // O1
    expect(hit([5, 2.0, 1.5])).toBe('W8'); // above O1's clearance
    expect(hit([2.5, 1.5, 0])).toBeNull(); // D1
    expect(hit([5, 1.5, 4], () => 1.2)).toBeNull(); // over a cut-away wall
    expect(boxDist([2.3, 1, 3.8], pieces[0]?.lo ?? [], pieces[0]?.hi ?? [])).toBeCloseTo(0.2); // above the sofa
  });
});
