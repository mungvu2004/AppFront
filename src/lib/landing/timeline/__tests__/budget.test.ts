/** @vitest-environment node */
/**
 * The motion budget holds at every sampled step (0.01 screen) at 16:10, 4:3 and
 * 3:4: look rotation ≤ 30°/screen outside and ≤ 22° inside, interior travel ≤
 * 2.5 m/screen, exterior travel ≤ 0.8 look-distances/screen (dolly as |Δd|/d), FOV ≤ 6°/screen.
 * One turning direction per walk. One big motion at a time: while the storey or roof lifts, the camera is
 * near-still. Labels stay fully visible ≥ 0.5 screen. Recipes are checked too.
 */
import { describe, expect, it } from 'vitest';

import { LIMITS, load, rates } from '../budget';
import { furnitureOrder, furnitureSettle, wallSchedule } from '../recipes';
import { expand, makePath, makeRig, panLead } from '../rig';
import { SHOTS } from '../shots';
import { cameraAt, leave, SCHEDULE, stateAt, TRACK_SCREENS } from '..';

const STEP = 0.01;

describe('motion budget', () => {
  it.each([16 / 10, 16 / 9, 4 / 3, 3 / 4])('no step breaks a limit at aspect %d', (aspect) => {
    const rig = makeRig(makePath(expand(SHOTS, aspect)), SCHEDULE.durs);
    const bad: string[] = [];
    let prev = rig.pose(0);
    let peak = 0;
    for (let t = STEP; t <= TRACK_SCREENS + 1e-9; t += STEP) {
      const q = rig.pose(t);
      const r = rates(prev, q, STEP);
      peak = Math.max(peak, load(r));
      if (load(r) > 1.02) bad.push(`t=${t.toFixed(2)} deg ${r.deg.toFixed(1)} m ${r.m.toFixed(2)} fov ${r.fov.toFixed(1)}`);
      prev = q;
    }
    expect(bad.slice(0, 8)).toEqual([]);
    expect(peak).toBeGreaterThan(0.5); // the schedule is tight, not padded
  });

  it('derives the track from the schedule, holds ≥ 0.4 screen', () => {
    expect(TRACK_SCREENS).toBe(SCHEDULE.total);
    SCHEDULE.names.forEach((n, i) => {
      if (n.endsWith(':end')) expect(SCHEDULE.durs[i - 1]).toBeGreaterThanOrEqual(0.4);
    });
    expect(LIMITS.insideDeg).toBeLessThan(LIMITS.outsideDeg);
  });

  it('moves one big thing at a time: no storey or roof lift while the camera swings', () => {
    const bad: string[] = [];
    const H = 0.02;
    let a = stateAt(0);
    for (let t = H; t <= TRACK_SCREENS; t += H) {
      const b = stateAt(t / TRACK_SCREENS);
      const lift = Math.abs(b.build.upperLiftM - a.build.upperLiftM) + Math.abs(b.build.roofLiftM - a.build.roofLiftM);
      if (lift / H > 0.05) {
        const deg = (Math.acos(Math.min(1, dirDot(a.camera, b.camera))) * 180) / Math.PI / H;
        if (deg > 12) bad.push(`t=${t.toFixed(2)} lift ${(lift / H).toFixed(2)} m/scr while turning ${deg.toFixed(1)}°/scr`);
      }
      a = b;
    }
    expect(bad.slice(0, 6)).toEqual([]);
  });

  it('turns one way per walk: the yaw changes direction at most once, inside a hold', () => {
    const H = 0.02;
    const yaw = (t: number): number => {
      const c = cameraAt(t / TRACK_SCREENS);
      return Math.atan2(c.target[0] - c.position[0], c.target[2] - c.position[2]);
    };
    const runs: { sign: number; t: number; deg: number }[] = [];
    let prev = yaw(0);
    for (let t = H; t <= TRACK_SCREENS; t += H) {
      const y = yaw(t);
      const d = ((y - prev + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      prev = y;
      const deg = (d * 180) / Math.PI;
      if (Math.abs(deg / H) < 2) continue; // still: a hold or a pure dolly
      const last = runs.at(-1);
      if (last?.sign === Math.sign(deg)) last.deg += deg;
      else runs.push({ sign: Math.sign(deg), t, deg });
    }
    const real = runs.filter((r) => Math.abs(r.deg) > 3);
    expect(real.length, real.map((r) => `${r.t.toFixed(2)} ${r.deg.toFixed(0)}°`).join(' · ')).toBeLessThanOrEqual(2);
    // The one change comes after the hero settle hold (S05 swings left, the walk from the street on turns right).
    if (real.length === 2) expect(real[1]?.t).toBeGreaterThanOrEqual(leave('hero-settle') - 0.05);
  });

  it('keeps every label fully up for at least half a screen', () => {
    const span = new Map<string, number>();
    const H = 0.02;
    for (let t = 0; t <= TRACK_SCREENS; t += H) {
      for (const [id, v] of Object.entries(stateAt(t / TRACK_SCREENS).labels)) {
        if (v >= 0.999) span.set(id, (span.get(id) ?? 0) + H);
      }
    }
    for (const [id, s] of span) expect(s, id).toBeGreaterThanOrEqual(0.48);
    expect(span.size).toBeGreaterThan(5);
  });
});

const dirDot = (a: { position: readonly number[]; target: readonly number[] }, b: typeof a): number => {
  const d = (c: typeof a): number[] => c.target.map((v, i) => v - (c.position[i] ?? 0));
  const [u, w] = [d(a), d(b)];
  const n = Math.hypot(...u) * Math.hypot(...w) || 1;
  return u.reduce((s, v, i) => s + v * (w[i] ?? 0), 0) / n;
};

describe('recipes', () => {
  it('staggers walls exterior-first with length-scaled durations', () => {
    const walls = [
      { id: 'a', ext: true, len: 10, dist: 5 },
      { id: 'b', ext: true, len: 5, dist: 2 },
      { id: 'c', ext: false, len: 3, dist: 1 },
    ];
    const [b, a, c] = wallSchedule(walls, 1);
    expect([b?.id, a?.id, c?.id]).toEqual(['b', 'a', 'c']);
    expect(a?.start).toBeCloseTo(1.07);
    expect((a?.end ?? 0) - (a?.start ?? 0)).toBeGreaterThan((b?.end ?? 0) - (b?.start ?? 0));
    expect(c?.start).toBeGreaterThanOrEqual(b?.end ?? 0);
  });

  it('settles furniture room by room with a 6 cm drop', () => {
    const slots = furnitureOrder(
      [
        { id: 'x', room: 'far', fromCentre: 0, roomDist: 9 },
        { id: 'y', room: 'near', fromCentre: 1, roomDist: 2 },
        { id: 'z', room: 'near', fromCentre: 0, roomDist: 2 },
      ],
      0,
    );
    expect(slots.map((s) => s.id)).toEqual(['z', 'y', 'x']);
    expect(furnitureSettle(0)).toEqual({ dropM: 0.06, scaleY: 0.97 });
    expect(furnitureSettle(1).dropM).toBe(0);
    expect(furnitureSettle(1).scaleY).toBeCloseTo(1);
  });

  it('leads the pan: orientation lands before the position', () => {
    expect(panLead(0)).toBe(0);
    expect(panLead(0.7)).toBeGreaterThan(0.9);
    expect(panLead(0.85)).toBe(1);
    expect(panLead(0.01) / 0.01).toBeCloseTo(1, 1);
  });
});
