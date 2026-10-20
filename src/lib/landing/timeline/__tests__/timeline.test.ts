/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { LANDING_HOUSE } from '../../house';
import { cameraAt, furnitureRise, SCENES, sceneAt, stateAt, WAYPOINTS } from '..';

const dist = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe('scenes', () => {
  it('tiles [0, 1] with the storyboard intervals', () => {
    expect(SCENES.map((s) => s.start)).toEqual([0, 0.08, 0.18, 0.3, 0.4, 0.55, 0.68, 0.78, 0.88]);
    expect(SCENES.at(-1)?.end).toBe(1);
    expect(sceneAt(0.08)).toEqual({ scene: 1, sceneLocal: 0 });
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
    for (let p = 0; p <= 0.08; p += 0.002) {
      const ink = stateAt(p).paper.ink;
      expect(ink).toBeGreaterThanOrEqual(prev);
      prev = ink;
    }
    expect(prev).toBe(1);
  });

  it('has every ground wall up by 0.47 and the upper storey by 0.55', () => {
    const ground = LANDING_HOUSE.plan.walls.filter((w) => w.levelId === 'T1').map((w) => w.id);
    const all = LANDING_HOUSE.plan.walls.map((w) => w.id);
    expect(ground.every((id) => stateAt(0.47).build.wallRise[id] === 1)).toBe(true);
    expect(ground.every((id) => (stateAt(0.4).build.wallRise[id] ?? 1) === 0)).toBe(true);
    expect(all.every((id) => stateAt(0.55).build.wallRise[id] === 1)).toBe(true);
    // Exterior walls lead: the first wall to move is load-bearing.
    const s = stateAt(0.433);
    const moving = ground.filter((id) => (s.build.wallRise[id] ?? 0) > 0);
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.every((id) => LANDING_HOUSE.plan.walls.find((w) => w.id === id)?.kind === 'loadBearing')).toBe(true);
  });

  it('covers every furniture id and falls back to the group value', () => {
    const s = stateAt(0.5);
    for (const f of LANDING_HOUSE.plan.furniture) {
      expect(s.build.furniture[f.id]).toBeTypeOf('number');
    }
    expect(stateAt(0.53).build.furniture['F1']).toBe(1);
    expect(furnitureRise(s, 'nope')).toBe(s.build.furniture['*']);
    expect(stateAt(0.56).build.furniture['F11']).toBe(1);
  });

  it('shows scene labels in their scenes and the finale settled', () => {
    expect(stateAt(0.22).labels['det:F1']).toBeGreaterThan(0.5);
    expect(stateAt(0.35).labels['gap']).toBe(1);
    expect(stateAt(0.36).review.highlight).toBe(1);
    expect(stateAt(0.4).review.close).toBe(1);
    expect(stateAt(0.85).compliance.bathDoor).toBe(1);
    expect(stateAt(0.79).build.upperLiftM).toBe(0);
    expect(stateAt(0.62).build.upperLiftM).toBe(4);
    const end = stateAt(1);
    expect(end.exports).toBe(1);
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
      for (let p = b - 0.003 + STEP; p <= b + 0.003; p += STEP) {
        const c = cameraAt(p);
        expect(dist(c.position, prev.position)).toBeLessThan(0.05);
        expect(dist(c.target, prev.target)).toBeLessThan(0.05);
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
      expect(d).toBeLessThan(0.1);
      expect(dist(c.target, prev.target)).toBeLessThan(0.1);
      expect(Math.abs(c.rollDeg)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.fovDeg - prev.fovDeg)).toBeLessThan(0.3);
      prev = c;
    }
    const varied = speeds.slice(0, 2000).some((v, i, a) => Math.abs(v - (a[i + 50] ?? v)) > 1e-3);
    expect(varied).toBe(true);
  });

  it('settles: p 0.97 and 1 frame the same shot', () => {
    const a = cameraAt(0.97);
    const b = cameraAt(1);
    expect(dist(a.position, b.position)).toBeLessThan(0.05);
    expect(dist(a.target, b.target)).toBeLessThan(0.02);
    expect(Math.abs(a.fovDeg - b.fovDeg)).toBeLessThan(0.05);
  });
});
