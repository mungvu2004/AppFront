/** @vitest-environment node */
/**
 * The camera never passes through architecture, read from the villa's data so
 * the check follows any plan: sampled densely, no sample is inside a wall of any
 * storey (at its real height, risen and cut away as the stage draws it, lifted
 * with its storey, inflated by a 0.25 m clearance) unless it sits in the
 * clearance tunnel of a door or void in that wall (site walls: a gate); none is inside an upper
 * floor slab, a stair, or a hip roof while the roof is in place (eave to ridge
 * over the eave outline); none is within 0.3 m of a furniture piece (lifted with
 * its storey), so the near plane never cuts into one. Samples near the walls are
 * < 0.3 m apart, so no step can hop across an inflated wall. 16:10, 4:3, 3:4.
 */
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '../../house';
import type { LandingState, StairSpec } from '../../types';
import { cameraAt, stateAt } from '..';

const CLEAR = 0.25;
const NEAR = 0.3;
const CUT_M = 1.2; // stage/house.ts CUTAWAY_HEIGHT_M
const SLAB_M = 0.3;
const ROOF_HIDDEN_M = 5.5; // stage/roof.ts: lifted clear away, hidden
const { plan, roofs } = LANDING_HOUSE;
const mm = (v: number): number => v / 1000;
const levels = [...plan.levels].sort((a, b) => a.elevationMm - b.elevationMm);
const liftK = (levelId: string): number => Math.max(0, levels.findIndex((l) => l.id === levelId));
const level = (levelId: string): { y: number; h: number } => {
  const l = levels.find((x) => x.id === levelId);
  return { y: mm(l?.elevationMm ?? 0), h: mm(l?.heightMm ?? 3000) };
};
const GROUND_TOP = level(levels[0]?.id ?? '').h;
type Build = LandingState['build'];
/** A storey is drawn once its rise starts (the ground always; upper ones with `build.upper`). */
const shown = (levelId: string, b: Build): boolean => liftK(levelId) === 0 || b.upper > 0;
const liftOf = (levelId: string, b: Build): number => liftK(levelId) * b.upperLiftM;

const walls = plan.walls.map((w) => {
  const [ax = 0, az = 0] = w.start.map(mm);
  const [bx = 0, bz = 0] = w.end.map(mm);
  const len = Math.hypot(bx - ax, bz - az);
  const holes = plan.openings
    .filter((o) => o.wallId === w.id && o.kind !== 'window')
    .map((o) => ({
      from: o.relativePosition * len - mm(o.widthMm) / 2 + CLEAR,
      to: o.relativePosition * len + mm(o.widthMm) / 2 - CLEAR,
      top: mm(o.sillHeightMm + o.heightMm) - CLEAR,
    }));
  const { y, h } = level(w.levelId ?? '');
  const height = w.heightMm === undefined ? h : mm(w.heightMm);
  return { id: w.id, levelId: w.levelId ?? '', y, h: height, ax, az, ux: (bx - ax) / len, uz: (bz - az) / len, len, half: mm(w.thicknessMm) / 2, holes };
});
/** Boundary and feature walls of the site, always standing (gates are holes; the site grows with `build.site`). */
const siteWalls = LANDING_HOUSE.site.walls.map((w) => {
  const [ax = 0, az = 0] = w.start.map(mm);
  const [bx = 0, bz = 0] = w.end.map(mm);
  const len = Math.hypot(bx - ax, bz - az);
  const holes = LANDING_HOUSE.site.gates
    .filter((g) => g.wallId === w.id)
    .map((g) => ({ from: g.relativePosition * len - mm(g.widthMm) / 2 + CLEAR, to: g.relativePosition * len + mm(g.widthMm) / 2 - CLEAR, top: 2 }));
  return { id: w.id, levelId: 'site', y: mm(w.baseMm), h: mm(w.heightMm), ax, az, ux: (bx - ax) / len, uz: (bz - az) / len, len, half: mm(w.thicknessMm) / 2, holes };
});
walls.push(...siteWalls);
type Wall = (typeof walls)[number];

/** Which wall the point collides with; `spanOf` gives a wall's [foot, top] now (null = not drawn). */
function hit(q: readonly number[], spanOf: (w: Wall) => readonly [number, number] | null): string | null {
  const [x = 0, y = 0, z = 0] = q;
  for (const s of walls) {
    const span = spanOf(s);
    if (span === null || y >= span[1] + CLEAR || y <= span[0] - CLEAR) continue;
    const dx = x - s.ax;
    const dz = z - s.az;
    const along = dx * s.ux + dz * s.uz;
    const across = Math.abs(dx * -s.uz + dz * s.ux);
    if (across > s.half + CLEAR || along < -CLEAR - s.half || along > s.len + CLEAR + s.half) continue;
    if (!s.holes.some((o) => along >= o.from && along <= o.to && y - span[0] <= o.top)) return s.id;
  }
  return null;
}

type Box = readonly [readonly number[], readonly number[]];
const inBox = (q: readonly number[], [lo, hi]: Box): boolean => q.every((v, i) => v > (lo[i] ?? 0) - CLEAR && v < (hi[i] ?? 0) + CLEAR);
const boxDist = (q: readonly number[], [lo, hi]: Box): number =>
  Math.hypot(...q.map((v, i) => Math.max((lo[i] ?? 0) - v, 0, v - (hi[i] ?? 0))));
const up = ([lo, hi]: Box, dy: number): Box => [lo.map((v, i) => (i === 1 ? v + dy : v)), hi.map((v, i) => (i === 1 ? v + dy : v))];
const bounds = (xs: number[], zs: number[], y0: number, y1: number): Box => [
  [Math.min(...xs), y0, Math.min(...zs)],
  [Math.max(...xs), y1, Math.max(...zs)],
];

/** Upper floor slabs: the bounding box of each upper storey's walls, at its floor. */
const slabs = levels.slice(1).map((l) => {
  const ws = walls.filter((w) => w.levelId === l.id);
  const y = mm(l.elevationMm);
  return { levelId: l.id, box: bounds(ws.flatMap((w) => [w.ax, w.ax + w.ux * w.len]), ws.flatMap((w) => [w.az, w.az + w.uz * w.len]), y - SLAB_M, y) };
});

/** A (U-)stair's flights and landing as one box. */
function stairBox(s: StairSpec): Box {
  const [sx = 0, sz = 0] = s.startMm.map(mm);
  const w = mm(s.widthMm);
  const back = s.landing === undefined ? 0 : w + mm(s.landing.gapMm);
  const west = s.landing?.returnsOn === 'west';
  const run = mm(((s.landing?.afterRisers ?? s.risers) - 1) * s.treadMm) + mm(s.landing?.depthMm ?? 0);
  const y = level(s.levelId).y;
  return [
    [sx - w / 2 - (west ? back : 0), y, sz],
    [sx + w / 2 + (west ? 0 : back), y + mm(s.risers * s.riserMm), sz + run],
  ];
}
const stairs = [LANDING_HOUSE.stair, LANDING_HOUSE.topStair].flatMap((s) => (s === undefined ? [] : [{ levelId: s.levelId, box: stairBox(s) }]));

const pieces = plan.furniture.map((f) => {
  const sideways = f.facing === 'east' || f.facing === 'west';
  const [w = 0, d = 0, h = 0] = f.sizeMm.map(mm);
  const [cx = 0, cz = 0] = f.centreMm.map(mm);
  const [hx, hz] = sideways ? [d / 2, w / 2] : [w / 2, d / 2];
  const y = level(f.levelId ?? '').y + mm(f.liftMm ?? 0);
  return { id: f.id, levelId: f.levelId ?? '', box: bounds([cx - hx, cx + hx], [cz - hz, cz + hz], y, y + h) };
});

/** Hip roofs as eave-to-ridge boxes over their eave outline, riding the roof and storey lifts. */
const hips = roofs.hips.map((r) => ({
  id: r.id,
  levelId: r.levelId,
  box: bounds(r.eave.map((p) => mm(p[0] ?? 0)), r.eave.map((p) => mm(p[1] ?? 0)), mm(r.eaveMm), mm(r.ridgeMm)),
}));

/** Everything the point is inside or too near at build state `b`. */
function collisions(c: readonly number[], b: Build): string[] {
  const bad: string[] = [];
  const wall = hit(c, (w) => {
    if (w.levelId === 'site') return b.site > 0 ? [w.y, w.y + w.h] : null;
    if (!shown(w.levelId, b)) return null;
    const foot = w.y + liftOf(w.levelId, b);
    return [foot, foot + Math.min(w.h * (b.wallRise[w.id] ?? 0), w.h + (CUT_M - w.h) * b.cutaway)];
  });
  if (wall !== null) bad.push(`in ${wall}`);
  for (const s of slabs) if (shown(s.levelId, b) && inBox(c, up(s.box, liftOf(s.levelId, b)))) bad.push(`in slab ${s.levelId}`);
  for (const s of stairs) if (b.stair > 0 && shown(s.levelId, b) && inBox(c, up(s.box, liftOf(s.levelId, b)))) bad.push(`in stair ${s.levelId}`);
  if (b.roof > 0.5 && b.roofLiftM < ROOF_HIDDEN_M) {
    for (const r of hips) {
      const dy = r.levelId === 'site' ? 0 : b.roofLiftM + liftOf(r.levelId, b);
      if (inBox(c, up(r.box, dy))) bad.push(`in roof ${r.id}`);
    }
  }
  for (const f of pieces) {
    if ((b.furniture[f.id] ?? 0) > 0 && shown(f.levelId, b) && boxDist(c, up(f.box, liftOf(f.levelId, b))) < NEAR) bad.push(`near ${f.id}`);
  }
  if ((c[1] ?? 0) < 0.5) bad.push('below eye floor');
  return bad;
}

describe('camera path collision', () => {
  it.each([16 / 10, 4 / 3, 3 / 4])('passes only through openings with clearance at aspect %d', (aspect) => {
    const STEP = 2e-4;
    const bad: string[] = [];
    let prev = cameraAt(0, aspect).position;
    for (let k = 0; k <= 1 / STEP; k += 1) {
      const p = k * STEP;
      const c = cameraAt(p, aspect).position;
      const at = `p=${p.toFixed(4)} (${c.map((v) => v.toFixed(2)).join(',')})`;
      const step = Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]);
      if (Math.min(c[1], prev[1]) < GROUND_TOP + 1 && step >= 0.3) bad.push(`${at} long step ${step.toFixed(2)}`);
      prev = c;
      for (const why of collisions(c, stateAt(p).build)) bad.push(`${at} ${why}`);
    }
    expect(bad.slice(0, 12)).toEqual([]);
  });

  it('flags a path through architecture (the check itself works)', () => {
    const b = stateAt(1).build; // everything home: walls up, storeys down, roofs on
    const front = walls.find((w) => w.id === 'W1');
    const d1 = plan.openings.find((o) => o.id === 'D1');
    if (front === undefined || d1 === undefined) throw new Error('W1 / D1 missing');
    const doorX = front.ax + front.ux * d1.relativePosition * front.len;
    expect(collisions([doorX - 4, 1.5, front.az], b)).toContain('in W1');
    expect(collisions([doorX, 1.5, front.az], b)).not.toContain('in W1'); // through D1
    expect(collisions([doorX, mm(d1.heightMm), front.az], b)).toContain('in W1'); // at the door head
    expect(collisions([doorX - 4, 1.4, front.az], { ...b, cutaway: 1 })).toContain('in W1'); // < cut + clearance
    expect(collisions([doorX - 4, 1.5, front.az], { ...b, cutaway: 1 })).not.toContain('in W1');
    const slab = slabs[0];
    if (slab !== undefined) {
      const [lo, hi] = slab.box;
      const mid = [((lo[0] ?? 0) + (hi[0] ?? 0)) / 2, hi[1] ?? 0, ((lo[2] ?? 0) + (hi[2] ?? 0)) / 2];
      expect(collisions(mid, b)).toContain(`in slab ${slab.levelId}`);
      expect(collisions(mid, { ...b, upperLiftM: 3.4 })).not.toContain(`in slab ${slab.levelId}`);
    }
    const sofa = pieces.find((f) => f.id === 'F-G2-SOFA');
    if (sofa !== undefined) {
      expect(collisions([(sofa.box[0][0] ?? 0) + 0.1, (sofa.box[1][1] ?? 0) + 0.2, (sofa.box[0][2] ?? 0) + 0.1], b)).toContain('near F-G2-SOFA');
    }
    const roof = hips[0];
    if (roof !== undefined) {
      const [lo, hi] = roof.box;
      const q = [((lo[0] ?? 0) + (hi[0] ?? 0)) / 2, ((lo[1] ?? 0) + (hi[1] ?? 0)) / 2 + b.roofLiftM, (lo[2] ?? 0) + 0.5];
      expect(collisions(q, b)).toContain(`in roof ${roof.id}`);
    }
  });
});
