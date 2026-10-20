/**
 * The camera path as a pure function of time (in screens).
 *
 * Waypoints are resolved shots (framing.ts). Position runs on one centripetal
 * Catmull–Rom spline; orientation is NOT a target spline: each waypoint's look
 * is stored as yaw/pitch (yaw unwrapped to the shortest arc) and interpolated on
 * a cubic Hermite, so the camera can never walk through its own look-at point
 * and flip. Look distance (log), FOV and roll ride their own Hermite channels
 * (zero tangent at holds). On a move into a hold the orientation is time-warped
 * (`panLead`) so the pan lands before the dolly does.
 *
 * Time inside a segment goes through a Hermite speed profile over the segment's
 * combined length (travel in look distances × 6 m + 3 m per radian of turn, so
 * spins in place get time and dives decelerate in screen space):
 * holds are reached at zero speed, pass-throughs at 0.8 × the slower neighbour.
 */

import { CatmullRomCurve3, Vector3 } from 'three';

import type { LandingState, Vec3 } from '../types';

import { frame } from './framing';
import type { ShotKey } from './shots';

export const clamp01 = (p: number): number => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0);

export interface Waypoint {
  readonly name: string;
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fovDeg: number;
  readonly rollDeg: number;
  /** Arrive and leave with zero speed: a reveal or a held composition. */
  readonly hold: boolean;
  /** Minimum screens for the move into this waypoint. */
  readonly min: number;
  readonly scene?: string;
}

type V = [number, number, number];
export interface Pose {
  readonly position: V;
  readonly fwd: V;
  readonly dist: number;
  readonly fovDeg: number;
  readonly rollDeg: number;
}

/** Rotation counted as travel in the speed profile: 3 m per radian ≈ a walking-pace pan. */
export const M_PER_RAD = 3;
/** Travel of one look distance counted as this many metres (≈ an interior shot's look distance). */
export const M_PER_REL = 6;
export const PAN_LEAD = 0.85;
const MAX_ROLL = 2;
const SAMPLES = 48;
const HOLD_MIN = 0.4;
const PUSH = 0.03;
const ORBIT_STEPS = 3;

const sub = (a: readonly number[], b: readonly number[]): V => [
  (a[0] ?? 0) - (b[0] ?? 0),
  (a[1] ?? 0) - (b[1] ?? 0),
  (a[2] ?? 0) - (b[2] ?? 0),
];
const lerp3 = (a: readonly number[], b: readonly number[], t: number): V => [
  (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t,
  (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t,
  (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t,
];
const len3 = (v: readonly number[]): number => Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
export const angleBetween = (a: V, b: V): number =>
  Math.acos(Math.min(1, Math.max(-1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len3(a) * len3(b) || 1))));
/**
 * Perceived travel of one small step, in look distances: the dolly part as |Δd|/d (zoom reads
 * logarithmically, so a dive from 80 m to 20 m costs what 20 m to 5 m does) and the sideways part
 * (across the view) relative to the nearer look distance. Travel along the view that does not change
 * the look distance (the look point moving with the eye) counts as sideways travel.
 */
export function relStep(a: Pose, b: Pose): number {
  const m = sub(b.position, a.position);
  const d = Math.max(1, Math.min(a.dist, b.dist));
  const dolly = Math.abs(Math.log(Math.max(1, b.dist) / Math.max(1, a.dist)));
  const along = m[0] * a.fwd[0] + m[1] * a.fwd[1] + m[2] * a.fwd[2];
  const side = Math.sqrt(Math.max(0, len3(m) ** 2 - along * along));
  const slide = Math.max(0, Math.abs(along) - Math.abs(b.dist - a.dist));
  return Math.hypot(dolly, side / d, slide / d);
}
const unwrap = (y: number, prev: number): number => y + 2 * Math.PI * Math.round((prev - y) / (2 * Math.PI));

/**
 * Pan before dolly: orientation parameter for path parameter `u`. Leaves with slope 1 (continuous with
 * the previous segment) and lands at `u = lead` with slope 0, then holds.
 */
export function panLead(u: number, lead = PAN_LEAD): number {
  if (u >= lead) return 1;
  const t = Math.max(0, u) / lead;
  return lead * (t * t * t - 2 * t * t + t) + (3 * t * t - 2 * t * t * t);
}

/**
 * Orbit about a fixed point: the eye swings from `a` to `b` on a sphere around `pivot` (azimuth on the
 * shortest arc, elevation linear, radius geometric) while the look stays on the pivot line.
 */
export function orbitEye(a: Vec3, b: Vec3, pivot: Vec3, t: number): V {
  const da = sub(a, pivot);
  const db = sub(b, pivot);
  const ra = len3(da) || 1;
  const rb = len3(db) || 1;
  const azA = Math.atan2(da[0], da[2]);
  const azB = unwrap(Math.atan2(db[0], db[2]), azA);
  const elA = Math.asin(da[1] / ra);
  const elB = Math.asin(db[1] / rb);
  const az = azA + (azB - azA) * t;
  const el = elA + (elB - elA) * t;
  const r = ra * (rb / ra) ** t;
  return [pivot[0] + r * Math.cos(el) * Math.sin(az), pivot[1] + r * Math.sin(el), pivot[2] + r * Math.cos(el) * Math.cos(az)];
}

/** The shot list resolved for one aspect: holds become arrive/leave pairs, orbits gain arc points. */
export function expand(keys: readonly ShotKey[], aspect: number): Waypoint[] {
  const out: Waypoint[] = [];
  for (const key of keys) {
    const f = frame(key.shot, aspect);
    const base = { name: key.name, rollDeg: key.rollDeg, ...f, ...(key.scene === undefined ? {} : { scene: key.scene }) };
    const prev = out.at(-1);
    const min = key.min ?? 0;
    if (key.orbit === true && prev !== undefined) {
      const pivot = lerp3(prev.target, f.target, 0.5);
      for (let k = 1; k < ORBIT_STEPS; k += 1) {
        const t = k / ORBIT_STEPS;
        const position = orbitEye(prev.position, f.position, pivot, t);
        const look = lerp3(prev.target, f.target, t);
        out.push({
          name: `${key.name}<${k}`,
          position,
          target: look,
          fovDeg: prev.fovDeg + (f.fovDeg - prev.fovDeg) * t,
          rollDeg: prev.rollDeg + (key.rollDeg - prev.rollDeg) * t,
          hold: false,
          min: min / ORBIT_STEPS,
        });
      }
    }
    const into = key.orbit === true && prev !== undefined ? min / ORBIT_STEPS : min;
    out.push({ ...base, hold: key.hold !== undefined, min: into });
    if (key.hold !== undefined) {
      // The hold: same composition, a slow push-in of `push` of the look distance (lens unchanged).
      const push = key.push ?? PUSH;
      const end = lerp3(f.position, f.target, push);
      out.push({ name: `${key.name}:end`, rollDeg: key.rollDeg, ...f, position: end, hold: true, min: Math.max(HOLD_MIN, key.hold) });
    }
  }
  return out;
}

/** Catmull–Rom Hermite through one scalar per waypoint; zero tangent at the ends and at holds. */
function hermite(ys: readonly number[], holds: readonly boolean[], i: number, f: number): number {
  const N = ys.length - 1;
  const y = (k: number): number => ys[Math.min(N, Math.max(0, k))] ?? 0;
  const tan = (k: number): number => (k <= 0 || k >= N || holds[k] === true ? 0 : (y(k + 1) - y(k - 1)) / 2);
  const f2 = f * f;
  const f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * y(i) + (f3 - 2 * f2 + f) * tan(i) + (3 * f2 - 2 * f3) * y(i + 1) + (f3 - f2) * tan(i + 1);
}

export interface Path {
  readonly wps: readonly Waypoint[];
  /** Pose in segment `i` at path parameter `u` ∈ [0, 1]. */
  pose(i: number, u: number): Pose;
  /** Combined length per segment (m + M_PER_RAD × rad) and its normalised cumulative table. */
  readonly len: readonly number[];
  readonly cum: readonly (readonly number[])[];
}

/** The time-independent geometry through resolved waypoints. */
export function makePath(wps: readonly Waypoint[]): Path {
  const N = wps.length - 1;
  const POS = new CatmullRomCurve3(
    wps.map((w) => new Vector3(...w.position)),
    false,
    'centripetal',
  );
  const holds = wps.map((w) => w.hold);
  const yaw: number[] = [];
  const pitch: number[] = [];
  const logDist: number[] = [];
  wps.forEach((w, k) => {
    const d = sub(w.target, w.position);
    const dist = len3(d) || 1;
    const y = Math.atan2(d[0], d[2]);
    yaw.push(k === 0 ? y : unwrap(y, yaw[k - 1] ?? y));
    pitch.push(Math.asin(Math.max(-1, Math.min(1, d[1] / dist))));
    logDist.push(Math.log(dist));
  });
  const fov = wps.map((w) => w.fovDeg);
  const roll = wps.map((w) => w.rollDeg);
  const tmp = new Vector3();

  const pose = (i: number, u: number): Pose => {
    const uo = holds[i + 1] === true ? panLead(u) : u;
    POS.getPoint((i + u) / N, tmp);
    const ya = hermite(yaw, holds, i, uo);
    const pi = hermite(pitch, holds, i, uo);
    return {
      position: [tmp.x, tmp.y, tmp.z],
      fwd: [Math.sin(ya) * Math.cos(pi), Math.sin(pi), Math.cos(ya) * Math.cos(pi)],
      dist: Math.exp(hermite(logDist, holds, i, u)), // follows the dolly, not the pan lead
      fovDeg: hermite(fov, holds, i, u),
      rollDeg: Math.min(MAX_ROLL, Math.max(-MAX_ROLL, hermite(roll, holds, i, u))),
    };
  };

  const len: number[] = [];
  const cum: number[][] = [];
  for (let i = 0; i < N; i += 1) {
    let prev = pose(i, 0);
    let acc = 0;
    const c = [0];
    for (let k = 1; k <= SAMPLES; k += 1) {
      const q = pose(i, k / SAMPLES);
      // Travel counts relative to the look distance (relStep), so a dive from 60 m to a close shot runs
      // at a constant screen-space rate (fast while far, slow on arrival) instead of a constant m/s.
      acc += M_PER_REL * relStep(prev, q) + M_PER_RAD * angleBetween(q.fwd, prev.fwd);
      c.push(acc);
      prev = q;
    }
    len.push(acc);
    cum.push(c.map((v, k) => (acc > 1e-9 ? v / acc : k / SAMPLES)));
  }
  return { wps, pose, len, cum };
}

/** Path parameter at arc fraction `f`. */
function paramAt(cum: readonly number[], f: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  let k = 0;
  while (k < SAMPLES - 1 && (cum[k + 1] as number) < f) k += 1;
  const c0 = cum[k] as number;
  const c1 = cum[k + 1] as number;
  return (k + (c1 > c0 ? (f - c0) / (c1 - c0) : 0)) / SAMPLES;
}

export interface Rig {
  /** Screen time at which each waypoint is reached, and the total. */
  readonly at: readonly number[];
  readonly total: number;
  pose(t: number): Pose;
  camera(t: number): LandingState['camera'];
}

/** The path timed by `durs` (screens per segment). */
export function makeRig(path: Path, durs: readonly number[]): Rig {
  const { wps, len, cum } = path;
  const N = wps.length - 1;
  const at = [0];
  durs.forEach((d) => at.push((at.at(-1) as number) + d));
  const total = at[N] as number;
  const mean = len.map((l, i) => l / (durs[i] as number));
  const speed = wps.map((w, k) =>
    k === 0 || k === N || w.hold ? 0 : 0.8 * Math.min(mean[k - 1] as number, mean[k] as number),
  );
  const slopes = len.map((l, i) => {
    const m = (v: number): number => (l > 1e-9 ? Math.min(3, (v * (durs[i] as number)) / l) : 0);
    return [m(speed[i] as number), m(speed[i + 1] as number)] as const;
  });
  const profile = (i: number, s: number): number => {
    const [m0, m1] = slopes[i] as readonly [number, number];
    const s2 = s * s;
    const s3 = s2 * s;
    return m0 * (s3 - 2 * s2 + s) + (3 * s2 - 2 * s3) + m1 * (s3 - s2);
  };
  const pose = (t: number): Pose => {
    const q = Math.min(total, Math.max(0, Number.isFinite(t) ? t : 0));
    let i = 0;
    while (i < N - 1 && (at[i + 1] as number) <= q) i += 1;
    const s = Math.min(1, Math.max(0, (q - (at[i] as number)) / (durs[i] as number)));
    return path.pose(i, paramAt(cum[i] as number[], profile(i, s)));
  };
  const camera = (t: number): LandingState['camera'] => {
    const c = pose(t);
    const target: Vec3 = [c.position[0] + c.fwd[0] * c.dist, c.position[1] + c.fwd[1] * c.dist, c.position[2] + c.fwd[2] * c.dist];
    return { position: c.position, target, fovDeg: c.fovDeg, rollDeg: c.rollDeg };
  };
  return { at, total, pose, camera };
}
