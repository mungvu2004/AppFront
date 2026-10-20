/** @vitest-environment node */
/**
 * The camera never passes through architecture: sampled densely, no sample is
 * inside a ground-floor wall slab (walls treated at full 3 m height, inflated
 * by the 0.25 m clearance) unless it sits in the clearance tunnel of a door or
 * void in that wall; none is inside the stair or, while it exists, the upper
 * storey's block at its current lift. Samples are < 0.3 m apart, so no step
 * can hop across a 0.61 m inflated slab.
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

/** Which wall (if any) the point collides with. */
function hit([x, y, z]: readonly number[]): string | null {
  if ((y ?? 0) >= WALL_H + CLEAR) return null;
  for (const s of slabs) {
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

const inBox = (q: readonly number[], lo: readonly number[], hi: readonly number[]): boolean =>
  q.every((v, i) => v > (lo[i] ?? 0) - CLEAR && v < (hi[i] ?? 0) + CLEAR);

describe('camera path collision', () => {
  it('passes only through openings with clearance', () => {
    const STEP = 2e-4;
    const bad: string[] = [];
    let prev = cameraAt(0).position;
    const stair = LANDING_HOUSE.stair;
    const sx = stair.startMm[0] / 1000;
    const sz = stair.startMm[1] / 1000;
    const run = ((stair.risers - 1) * stair.treadMm) / 1000;
    for (let k = 0; k <= 1 / STEP; k += 1) {
      const p = k * STEP;
      const c = cameraAt(p).position;
      expect(Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])).toBeLessThan(0.3);
      prev = c;
      const wall = hit(c);
      if (wall !== null) bad.push(`p=${p.toFixed(4)} in ${wall} at ${c.map((v) => v.toFixed(2)).join(',')}`);
      const w = stair.widthMm / 2000;
      if (inBox(c, [sx - w, 0, sz], [sx + w, 3, sz + run])) bad.push(`p=${p.toFixed(4)} in stair`);
      const b = stateAt(p).build;
      if (b.upper > 0 && inBox(c, [-0.11, 2.8 + b.upperLiftM, -0.11], [8.11, 6 + b.upperLiftM, 9.11])) {
        bad.push(`p=${p.toFixed(4)} in upper storey (lift ${b.upperLiftM.toFixed(2)})`);
      }
      if (c[1] < 0.5) bad.push(`p=${p.toFixed(4)} below eye floor`);
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('flags a path through a wall (the check itself works)', () => {
    expect(hit([5, 1.5, 4])).toBe('W8');
    expect(hit([5, 1.5, 1.5])).toBeNull(); // O1
    expect(hit([5, 2.0, 1.5])).toBe('W8'); // above O1's clearance
    expect(hit([2.5, 1.5, 0])).toBeNull(); // D1
  });
});
