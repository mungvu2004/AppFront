/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '../../house';
import { arrive, cameraAt, furnitureRise, leave, SCENES, sceneAt, stateAt, TRACK_SCREENS, WAYPOINTS } from '..';
import { ROOF_AWAY_M, SECTION_LIFT_M } from '../choreo';

const P = (screens: number): number => screens / TRACK_SCREENS;
/** Thresholds were set for 1e-4 p on the v1 9-screen track (0.0009 screen); scale them per screen. */
const K = (1e-4 * TRACK_SCREENS) / 0.0009;
interface Cam { position: readonly number[]; target: readonly number[] }
const turn = (a: Cam, b: Cam): number => {
  const d = (c: Cam): number[] => c.target.map((v, i) => v - (c.position[i] ?? 0));
  const [u, w] = [d(a), d(b)];
  const cos = u.reduce((s, v, i) => s + v * (w[i] ?? 0), 0) / (Math.hypot(...u) * Math.hypot(...w) || 1);
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
};

const dist = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe('scenes', () => {
  it('tiles [0, 1] with the storyboard intervals', () => {
    expect(SCENES).toHaveLength(9);
    expect(SCENES[0]?.start).toBe(0);
    SCENES.slice(1).forEach((s, i) => expect(s.start).toBe(SCENES[i]?.end));
    expect(SCENES.at(-1)?.end).toBe(1);
    expect(sceneAt(SCENES[1]?.start ?? 0)).toEqual({ scene: 1, sceneLocal: 0 });
    expect(sceneAt(1)).toEqual({ scene: 8, sceneLocal: 1 });
    expect(sceneAt(-3).scene).toBe(0);
  });
});

describe('stateAt', () => {
  it('is deterministic whatever order it is sought in', () => {
    const fresh = [0.3, 0.7, 0.05, 0.5].map((p) => JSON.stringify(stateAt(p)));
    const order = [1, 0.3, 0.7, 0.3, 0, 0.5, 0.05, 0.7, 0.98, 0.5];
    const seen = new Map(order.map((p) => [p, JSON.stringify(stateAt(p))]));
    expect([0.3, 0.7, 0.05, 0.5].map((p) => seen.get(p))).toEqual(fresh);
    expect(stateAt(0.42)).toEqual(stateAt(0.42));
    expect(Object.isFrozen(stateAt(0.5).build.wallRise)).toBe(true);
  });

  it('starts blank except the paper', () => {
    const s = stateAt(0);
    expect(s.paper.opacity).toBe(1);
    const zero = [
      ...Object.values(s.detect),
      ...Object.values(s.review),
      ...Object.values(s.compliance),
      ...Object.values(s.build.wallRise),
      ...Object.values(s.build.furniture),
      ...Object.values(s.labels),
      s.build.floors,
      s.build.joinery,
      s.build.material,
      s.build.stair,
      s.build.upper,
      s.build.upperLiftM,
      s.build.cutaway,
      s.exports,
      s.semantic,
    ];
    expect(zero.every((v) => v === 0)).toBe(true);
  });

  it('draws ink monotonically through S01', () => {
    let prev = -1;
    for (let p = 0; p <= (SCENES[1]?.start ?? 0); p += 0.0005) {
      const ink = stateAt(p).paper.ink;
      expect(ink).toBeGreaterThanOrEqual(prev);
      prev = ink;
    }
    expect(prev).toBe(1);
  });

  it('raises the ground walls through S05, exterior first, everything up by S06', () => {
    const ground = LANDING_HOUSE.plan.walls.filter((w) => w.levelId === LANDING_HOUSE.plan.levels[0]?.id).map((w) => w.id);
    const all = LANDING_HOUSE.plan.walls.map((w) => w.id);
    const s5 = SCENES[4]?.start ?? 0;
    const s6 = SCENES[5]?.start ?? 0;
    expect(ground.every((id) => (stateAt(s5).build.wallRise[id] ?? 1) === 0)).toBe(true);
    expect(all.every((id) => stateAt(s6).build.wallRise[id] === 1)).toBe(true);
    // Exterior walls lead: the first walls to move are exterior (load-bearing).
    let p = s5;
    while (ground.every((id) => (stateAt(p).build.wallRise[id] ?? 0) === 0) && p < s6) p += 0.0002;
    const s = stateAt(p + 0.0002);
    const moving = ground.filter((id) => (s.build.wallRise[id] ?? 0) > 0);
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.every((id) => LANDING_HOUSE.plan.walls.find((w) => w.id === id)?.kind === 'loadBearing')).toBe(true);
  });

  it('covers every furniture id and falls back to the group value', () => {
    const s = stateAt(SCENES[4]?.start ?? 0);
    for (const f of LANDING_HOUSE.plan.furniture) {
      expect(s.build.furniture[f.id]).toBeTypeOf('number');
    }
    const done = stateAt(SCENES[5]?.start ?? 0);
    expect(LANDING_HOUSE.plan.furniture.every((f) => done.build.furniture[f.id] === 1)).toBe(true);
    expect(furnitureRise(s, 'nope')).toBe(s.build.furniture['*']);
  });

  it('shows scene beats in their holds and the finale settled', () => {
    const mid = (name: string): number => P((arrive(name) + leave(name)) / 2);
    expect(stateAt(mid('recognise')).detect.labels).toBe(1);
    expect(stateAt(mid('gap-hold')).labels['gap']).toBe(1);
    expect(stateAt(mid('gap-hold')).review.highlight).toBe(1);
    expect(stateAt(P(leave('gap-hold'))).review.close).toBe(1);
    expect(stateAt(mid('checks')).compliance.bathDoor).toBe(1);
    expect(stateAt(mid('checks')).compliance.stair).toBe(1);
    expect(stateAt(P(arrive('living'))).build.ceiling).toBe(1);
    expect(stateAt(P(arrive('living'))).build.upperLiftM).toBe(0);
    expect(stateAt(mid('living')).build.upperLiftM).toBe(SECTION_LIFT_M);
    expect(stateAt(P(leave('living'))).build.cutaway).toBe(1);
    expect(stateAt(P(leave('living'))).build.ceiling).toBe(0);
    expect(stateAt(mid('section')).build.roofLiftM).toBe(ROOF_AWAY_M);
    expect(stateAt(P(arrive('checks'))).build.upperLiftM).toBe(SECTION_LIFT_M);
    expect(stateAt(1).build.upperLiftM).toBe(0);
    const s6 = stateAt(SCENES[5]?.start ?? 0).build;
    expect([s6.site, s6.planting, s6.roof, s6.water]).toEqual([1, 1, 1, 1]);
    const end = stateAt(1);
    expect(end.exports).toBe(1);
    expect(end.build.roofLiftM).toBe(0);
    expect(end.semantic).toBeCloseTo(0.15);
    expect(Object.values(end.labels).every((v) => v === 0)).toBe(true);
  });
});

describe('cameraAt', () => {
  it('names unique waypoints in increasing p from 0 to 1', () => {
    expect(new Set(WAYPOINTS.map((w) => w.name)).size).toBe(WAYPOINTS.length);
    expect(WAYPOINTS[0]?.p).toBe(0);
    expect(WAYPOINTS.at(-1)?.p).toBe(1);
    WAYPOINTS.slice(1).forEach((w, i) => expect(w.p).toBeGreaterThan(WAYPOINTS[i]?.p ?? 1));
    const opening = cameraAt(0);
    expect(opening.fovDeg).toBeLessThanOrEqual(14);
    expect(dist(opening.position, WAYPOINTS[0]?.position ?? [])).toBeLessThan(1e-6);
  });

  it('is continuous across every scene boundary and bounded in roll', () => {
    const STEP = 1e-4;
    for (const b of SCENES.slice(1).map((s) => s.start)) {
      let prev = cameraAt(b - 0.003);
      for (let p = b - 0.003 + STEP; p <= Math.min(1, b + 0.003); p += STEP) {
        const c = cameraAt(p);
        // No jump: < 0.08 m per 1e-4 of scroll (a discontinuity would be metres).
        expect(dist(c.position, prev.position)).toBeLessThan(0.08 * K);
        expect(turn(c, prev)).toBeLessThan(0.5 * K);
        expect(Math.abs(c.fovDeg - prev.fovDeg)).toBeLessThan(0.3);
        prev = c;
      }
    }
  });

  it('never teleports, never rolls past 2 degrees, never moves at constant speed', () => {
    const STEP = 1e-4;
    let prev = cameraAt(0);
    const speeds: number[] = [];
    for (let k = 1; k <= 1 / STEP; k += 1) {
      const c = cameraAt(k * STEP);
      const d = dist(c.position, prev.position);
      speeds.push(d);
      expect(d).toBeLessThan(0.1 * K);
      expect(turn(c, prev)).toBeLessThan(0.5 * K);
      expect(Math.abs(c.rollDeg)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.fovDeg - prev.fovDeg)).toBeLessThan(0.3);
      prev = c;
    }
    const varied = speeds.slice(0, 2000).some((v, i, a) => Math.abs(v - (a[i + 50] ?? v)) > 1e-3);
    expect(varied).toBe(true);
  });

  it('recomposes per aspect, deterministically; interiors keep their eye point', () => {
    expect(stateAt(0.95, 3 / 4)).toEqual(stateAt(0.95, 3 / 4));
    expect(cameraAt(0.3, 4 / 3)).toEqual(cameraAt(0.3, 4 / 3));
    // Portrait pulls the exterior hero back; the default aspect is 16:10.
    expect(dist(cameraAt(1, 3 / 4).position, cameraAt(1).position)).toBeGreaterThan(1);
    expect(cameraAt(1, 16 / 10)).toEqual(cameraAt(1));
    const living = WAYPOINTS.find((w) => w.name === 'living')?.p ?? 0;
    expect(dist(cameraAt(living, 3 / 4).position, cameraAt(living).position)).toBeLessThan(1e-9);
    expect(cameraAt(living, 3 / 4).fovDeg).toBeGreaterThan(cameraAt(living).fovDeg);
  });

  it('settles: the last 0.05 screen frames the same shot', () => {
    const a = cameraAt(1 - P(0.05));
    const b = cameraAt(1);
    expect(dist(a.position, b.position)).toBeLessThan(0.05);
    expect(dist(a.target, b.target)).toBeLessThan(0.02);
    expect(Math.abs(a.fovDeg - b.fovDeg)).toBeLessThan(0.05);
  });
});
