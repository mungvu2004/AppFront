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
 * Scene coordinates: metres, y up, plan y → z, front (street) at z = 0. The
 * camera always stays on the street side for the overview shots, so screen
 * right is roughly −x; framing offsets below push the house to the right of the
 * viewport to leave the left free for type.
 */

import { CatmullRomCurve3, Vector3 } from 'three';

import type { LandingState, Vec3 } from '../types';

import { clamp01 } from './scenes';

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

const w = (
  name: string,
  p: number,
  position: Vec3,
  target: Vec3,
  fovDeg: number,
  rollDeg: number,
  hold = false,
): Waypoint => ({ name, p, position, target, fovDeg, rollDeg, hold });

export const WAYPOINTS: readonly Waypoint[] = [
  // S01 — near-orthographic: very long lens, far above, plan right of centre.
  w('sheet', 0, [9.6, 66, 1.4], [9.8, 0, 4.6], 11, 0, true),
  w('sheet-lean', 0.075, [9.7, 56, -3], [9.6, 0, 4.5], 12.5, 0.2),
  // S02 — ~10° yaw, lens opening up.
  w('aligned', 0.16, [11.8, 42, -11], [9, 0.1, 4.6], 17, 0.5),
  // S03 — small orbit while layers appear.
  w('recognise', 0.235, [15.5, 31, -14.5], [8.6, 0.25, 4.6], 21, 0.8),
  // S04 — decelerate onto the gap in W7 and hold.
  w('gap-approach', 0.325, [13.8, 10.5, -3.6], [9.85, 0.15, 5], 27, 0.4),
  w('gap-hold', 0.37, [13.2, 8.6, -1.9], [9.8, 0.1, 5], 27, 0.3, true),
  // S05 — approach, lateral orbit front-right → front-left, target lifts as walls rise.
  w('hero-approach', 0.425, [14.4, 11, -8.6], [7.4, 0.5, 4.6], 30, 0.5),
  w('hero-orbit', 0.49, [8.8, 8.5, -10.7], [6.6, 1.3, 4.6], 33, 0.9),
  w('hero-settle', 0.545, [1.2, 12, -9.9], [5.8, 2, 4.4], 35, -0.4, true),
  // S06 — eye height 1.5 m: D1 → living → O1 → kitchen/dining → D2 → hall.
  w('entry', 0.582, [2.5, 1.65, -3.4], [2.5, 1.45, 2], 38, 0),
  w('door', 0.594, [2.5, 1.5, -0.4], [3, 1.4, 3.5], 40, 0),
  w('living', 0.607, [2.5, 1.5, 1.9], [4.6, 1.25, 3.9], 40, -0.3, true),
  w('o1', 0.622, [5, 1.5, 1.5], [8.6, 1.35, 2.4], 40, 0),
  w('kitchen', 0.636, [9.2, 1.5, 2.1], [10.8, 1.1, 0.9], 40, 0.3, true),
  w('d2', 0.652, [6.5, 1.5, 4.2], [6.5, 1.4, 6.2], 40, 0),
  w('hall-west', 0.664, [6.5, 1.5, 5.78], [4.5, 1.3, 5.85], 40, 0, true),
  w('hall-wc', 0.671, [6.52, 1.5, 5.79], [6.5, 1.25, 7.8], 40, 0, true),
  w('hall-east', 0.678, [6.55, 1.5, 5.8], [8.5, 1.3, 5.9], 40, 0, true),
  // S06 → S07 — up through the open top (upper storey lifted), out east, back and up.
  w('rise', 0.692, [6.7, 4.6, 5.85], [9, 2.2, 5.5], 38, 0),
  w('exit', 0.71, [11.5, 6, 4], [6, 2.4, 4.5], 36, 0.3),
  w('axo', 0.745, [20.4, 13, -2.7], [5, 2.6, 4.5], 34, 0.6, true),
  // S08 — down into the open-topped kitchen (x > 8), D5 framed through D2, the stair through O1.
  w('kitchen-drop', 0.795, [9.8, 2.2, 2], [7, 1.2, 5], 36, 0.3),
  w('wc-look', 0.812, [6.6, 1.65, 1.8], [6.5, 1.05, 6.5], 34, 0, true),
  w('stair-look', 0.842, [3.7, 1.6, 1.6], [0.6, 1.4, 2.5], 36, 0, true),
  w('both', 0.872, [10.6, 2.3, 1.2], [4, 1, 3.8], 38, 0.2),
  // S09 — up and out to the settled isometric hero, house on the right two-thirds.
  w('lift-out', 0.9, [11, 5.2, 1.2], [6, 1.6, 4.2], 36, 0.4),
  w('hero', 0.955, [21.9, 11.8, -7.2], [8.1, 1.5, 6.6], 32, 0.6, true),
  w('rest', 1, [21.88, 11.78, -7.18], [8.09, 1.5, 6.59], 32, 0.6, true),
];

const N = WAYPOINTS.length - 1;
const SAMPLES = 48;
const MAX_ROLL = 2;

const curve = (pick: (x: Waypoint) => Vec3): CatmullRomCurve3 =>
  new CatmullRomCurve3(
    WAYPOINTS.map((x) => new Vector3(...pick(x))),
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

const POS_ARC = WAYPOINTS.slice(1).map((_, i) => arcTable(POS, i));
const TGT_ARC = WAYPOINTS.slice(1).map((_, i) => arcTable(TGT, i));

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
const SEG_T = WAYPOINTS.slice(1).map((x, i) => x.p - (WAYPOINTS[i] as Waypoint).p);
const MEAN = SEG_LEN.map((l, i) => l / (SEG_T[i] as number));

/** Speed (combined metres per unit p) at each waypoint. */
const SPEED = WAYPOINTS.map((x, k) => {
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
  const y = (k: number): number => pick(WAYPOINTS[Math.min(N, Math.max(0, k))] as Waypoint);
  const tan = (k: number): number =>
    k <= 0 || k >= N || WAYPOINTS[k]?.hold === true ? 0 : (y(k + 1) - y(k - 1)) / 2;
  const f2 = f * f;
  const f3 = f2 * f;
  return (
    (2 * f3 - 3 * f2 + 1) * y(i) + (f3 - 2 * f2 + f) * tan(i) + (3 * f2 - 2 * f3) * y(i + 1) + (f3 - f2) * tan(i + 1)
  );
}

const tmp = new Vector3();
const toVec = (v: Vector3): Vec3 => [v.x, v.y, v.z];

export function cameraAt(p: number): LandingState['camera'] {
  const q = clamp01(p);
  let i = 0;
  while (i < N - 1 && (WAYPOINTS[i + 1] as Waypoint).p <= q) i += 1;
  const s = Math.min(1, Math.max(0, (q - (WAYPOINTS[i] as Waypoint).p) / (SEG_T[i] as number)));
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
}
