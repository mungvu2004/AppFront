/**
 * The camera rig: named waypoints on two centripetal Catmull–Rom splines.
 *
 * Position and target each get their own spline (centripetal, so no cusps or
 * loops between unevenly spaced points). Between two waypoints the scroll
 * fraction is mapped through a cubic Hermite *speed profile* and then through
 * the segment's arc-length table, so the camera's real speed is what the
 * profile says rather than whatever the spline parametrisation happens to do:
 * a `hold` waypoint is arrived at with zero speed (decelerate into a reveal),
 * any other waypoint is passed at 80 % of the slower neighbouring segment's
 * mean speed (gentle acceleration through transitions, never constant velocity,
 * never a stop). FOV and roll follow the same eased parameter on a Catmull–Rom
 * Hermite, so they change smoothly too.
 *
 * The waypoints are resolved from the shot list (shots.ts) per viewport aspect
 * (framing.ts), and one rig is cached per aspect rounded to 0.01, so the same
 * p and aspect always give the same camera.
 */

import { CatmullRomCurve3, Vector3 } from 'three';

import type { LandingState, Vec3 } from '../types';

import { DEFAULT_ASPECT, frame } from './framing';
import { clamp01 } from './scenes';
import { SHOTS } from './shots';

export interface Waypoint {
  readonly name: string;
  readonly p: number;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fovDeg: number;
  readonly rollDeg: number;
  /** Arrive and leave with zero speed: a reveal or a held composition. */
  readonly hold?: boolean;
}

/** The shot list resolved for one aspect (width / height). */
export function waypointsFor(aspect: number): Waypoint[] {
  return SHOTS.map((x) => ({ name: x.name, p: x.p, rollDeg: x.rollDeg, hold: x.hold === true, ...frame(x.shot, aspect) }));
}

export const WAYPOINTS: readonly Waypoint[] = waypointsFor(DEFAULT_ASPECT);

const MAX_ROLL = 2;
const SAMPLES = 48;

type Rig = (p: number) => LandingState['camera'];

/** Splines + speed profile through one aspect's waypoints. */
function makeRig(WPS: readonly Waypoint[]): Rig {
  const N = WPS.length - 1;

  const curve = (pick: (x: Waypoint) => Vec3): CatmullRomCurve3 =>
    new CatmullRomCurve3(
      WPS.map((x) => new Vector3(...pick(x))),
      false,
      'centripetal',
    );

  const POS = curve((x) => x.position);
  const TGT = curve((x) => x.target);

  /** Cumulative arc length of segment `i`, normalised to [0, 1], plus its total. */
  function arcTable(c: CatmullRomCurve3, i: number): { cum: number[]; length: number } {
    const a = new Vector3();
    const b = c.getPoint(i / N, new Vector3());
    const cum = [0];
    let acc = 0;
    for (let k = 1; k <= SAMPLES; k += 1) {
      c.getPoint((i + k / SAMPLES) / N, a);
      acc += a.distanceTo(b);
      cum.push(acc);
      b.copy(a);
    }
    return { cum: cum.map((v) => (acc > 0 ? v / acc : 0)), length: acc };
  }

  const POS_ARC = WPS.slice(1).map((_, i) => arcTable(POS, i));
  const TGT_ARC = WPS.slice(1).map((_, i) => arcTable(TGT, i));

  /** Spline parameter (0..1 within the segment) at arc fraction `f`. */
  function paramAt(cum: readonly number[], f: number): number {
    if (f <= 0) return 0;
    if (f >= 1) return 1;
    let k = 0;
    while (k < SAMPLES - 1 && (cum[k + 1] as number) < f) k += 1;
    const c0 = cum[k] as number;
    const c1 = cum[k + 1] as number;
    return (k + (c1 > c0 ? (f - c0) / (c1 - c0) : 0)) / SAMPLES;
  }

  const SEG_LEN = POS_ARC.map((a, i) => a.length + (TGT_ARC[i] as { length: number }).length);
  const SEG_T = WPS.slice(1).map((x, i) => x.p - (WPS[i] as Waypoint).p);
  const MEAN = SEG_LEN.map((l, i) => l / (SEG_T[i] as number));

  /** Speed (combined metres per unit p) at each waypoint. */
  const SPEED = WPS.map((x, k) => {
    if (k === 0 || k === N || x.hold === true) return 0;
    return 0.8 * Math.min(MEAN[k - 1] as number, MEAN[k] as number);
  });

  /** Hermite slopes of the speed profile, in arc-fraction per segment-time-fraction. */
  const SLOPES = SEG_LEN.map((l, i) => {
    const t = SEG_T[i] as number;
    const m = (v: number): number => (l > 0 ? Math.min(3, (v * t) / l) : 0);
    return [m(SPEED[i] as number), m(SPEED[i + 1] as number)] as const;
  });

  /** Arc fraction travelled after segment-time fraction `s` (monotone: slopes ≤ 3). */
  function profile(i: number, s: number): number {
    const [m0, m1] = SLOPES[i] as readonly [number, number];
    const s2 = s * s;
    const s3 = s2 * s;
    return m0 * (s3 - 2 * s2 + s) + (3 * s2 - 2 * s3) + m1 * (s3 - s2);
  }

  /** Catmull–Rom Hermite through one scalar per waypoint, in waypoint parameter `u`. */
  function scalarAt(pick: (x: Waypoint) => number, i: number, f: number): number {
    const y = (k: number): number => pick(WPS[Math.min(N, Math.max(0, k))] as Waypoint);
    const tan = (k: number): number =>
      k <= 0 || k >= N || WPS[k]?.hold === true ? 0 : (y(k + 1) - y(k - 1)) / 2;
    const f2 = f * f;
    const f3 = f2 * f;
    return (
      (2 * f3 - 3 * f2 + 1) * y(i) + (f3 - 2 * f2 + f) * tan(i) + (3 * f2 - 2 * f3) * y(i + 1) + (f3 - f2) * tan(i + 1)
    );
  }

  const tmp = new Vector3();
  const toVec = (v: Vector3): Vec3 => [v.x, v.y, v.z];

  return (p: number): LandingState['camera'] => {
    const q = clamp01(p);
    let i = 0;
    while (i < N - 1 && (WPS[i + 1] as Waypoint).p <= q) i += 1;
    const s = Math.min(1, Math.max(0, (q - (WPS[i] as Waypoint).p) / (SEG_T[i] as number)));
    const f = profile(i, s);
    const position = toVec(POS.getPoint((i + paramAt((POS_ARC[i] as { cum: number[] }).cum, f)) / N, tmp));
    const target = toVec(TGT.getPoint((i + paramAt((TGT_ARC[i] as { cum: number[] }).cum, f)) / N, tmp));
    const roll = scalarAt((x) => x.rollDeg, i, f);
    return {
      position,
      target,
      fovDeg: scalarAt((x) => x.fovDeg, i, f),
      rollDeg: Math.min(MAX_ROLL, Math.max(-MAX_ROLL, roll)),
    };
  };
}

const rigs = new Map<number, Rig>();

/** The camera at scroll `p` for a viewport of `aspect` = width / height (16:10 by default). */
export function cameraAt(p: number, aspect: number = DEFAULT_ASPECT): LandingState['camera'] {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.round(Math.min(4, Math.max(0.3, aspect)) * 100) / 100 : DEFAULT_ASPECT;
  let rig = rigs.get(a);
  if (rig === undefined) {
    if (rigs.size > 16) rigs.clear();
    rig = makeRig(a === DEFAULT_ASPECT ? WAYPOINTS : waypointsFor(a));
    rigs.set(a, rig);
  }
  return rig(p);
}
