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
 * holds are reached drifting into their push-in (the look has already settled), pass-throughs at
 * 0.8 × the slower neighbour. Every channel is a Hermite in the same uniform `u` with one tangent per
 * waypoint, and the profile matches du/dt on both sides of a pass-through, so position, look, lens and
 * distance are all C1 in scroll there.
 */

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
/** Arrival speed into a hold, as a share of the push-in's mean pace: the push starts as the arrival eases out. */
const DRIFT = 0.8;
const ARRIVE = 0.25;

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
  /** Monotone (Fritsch–Carlson) slopes du/df at each table knot, so the inverse is C1, not a sawtooth. */
  readonly slope: readonly (readonly number[])[];
}

/** The time-independent geometry through resolved waypoints. */
export function makePath(wps: readonly Waypoint[]): Path {
  const N = wps.length - 1;
  const holds = wps.map((w) => w.hold);
  // Position: Catmull–Rom tangents, capped at the shorter neighbouring chord so a short push-in next to
  // a long move cannot loop (what the centripetal knots did, at the price of a speed kink per waypoint).
  const P = wps.map((w) => [...w.position] as V);
  const chord = (k: number): number => len3(sub(P[k + 1] ?? P[k] ?? [0, 0, 0], P[k] ?? [0, 0, 0]));
  const T = P.map((p, k): V => {
    if (k === 0 || k === N) return [0, 0, 0];
    // A hold's arrival already points along its push-in, so the drift does not bend at the hold.
    if (wps[k]?.hold === true && wps[k + 1]?.name === `${wps[k]?.name}:end`) return sub(P[k + 1] as V, p);
    const t = sub(P[k + 1] as V, P[k - 1] as V).map((v) => v / 2) as V;
    const cap = Math.min(chord(k - 1), chord(k));
    const l = len3(t);
    return l > cap && l > 0 ? (t.map((v) => (v * cap) / l) as V) : t;
  });
  const posAt = (i: number, u: number): V => {
    const u2 = u * u;
    const u3 = u2 * u;
    const [a, b, c, d] = [2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, 3 * u2 - 2 * u3, u3 - u2];
    const p0 = P[i] as V;
    const p1 = P[i + 1] ?? p0;
    const t0 = T[i] as V;
    const t1 = T[i + 1] ?? t0;
    return [0, 1, 2].map((k) => a * p0[k]! + b * t0[k]! + c * p1[k]! + d * t1[k]!) as V;
  };
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

  const pose = (i: number, u: number): Pose => {
    const uo = holds[i + 1] === true ? panLead(u) : u;
    const ya = hermite(yaw, holds, i, uo);
    const pi = hermite(pitch, holds, i, uo);
    return {
      position: posAt(i, u),
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
  // End slopes from the exact derivative, not the end interval's secant: the profile matches du/dt
  // across a waypoint through them, and a secant is far off where the arc rate changes fast (an arrival).
  const EPS = 1e-4;
  const rateAt = (i: number, u: number, du: number): number => {
    const a = pose(i, u);
    const b = pose(i, u + du);
    return (M_PER_REL * relStep(a, b) + M_PER_RAD * angleBetween(a.fwd, b.fwd)) / Math.abs(du);
  };
  const slope = cum.map((c, i) => {
    const m = monotoneSlopes(c);
    const l = len[i] as number;
    const fix = (k: number, r: number): void => {
      const cap = 3 * (k === 0 ? (m[0] as number) : (m[SAMPLES] as number));
      if (l > 1e-9 && r > 1e-12) m[k] = Math.min(cap, l / r);
    };
    fix(0, rateAt(i, 0, EPS));
    fix(SAMPLES, rateAt(i, 1, -EPS));
    return m;
  });
  return { wps, pose, len, cum, slope };
}

/** Knot slopes of u(f) through (cum[k], k / SAMPLES), Fritsch–Carlson: monotone, no overshoot. */
function monotoneSlopes(cum: readonly number[]): number[] {
  const d = cum.slice(1).map((c, k) => {
    const h = c - (cum[k] as number);
    return h > 1e-12 ? 1 / SAMPLES / h : 1e6;
  });
  return cum.map((_, k) => {
    const a = d[k - 1] ?? d[k] ?? 0;
    const b = d[k] ?? a;
    return a > 0 && b > 0 ? (2 * a * b) / (a + b) : 0;
  });
}

/** Path parameter at arc fraction `f`: cubic Hermite on the arc table (binary search). */
function paramAt(cum: readonly number[], slope: readonly number[], f: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  let lo = 0;
  let hi = SAMPLES;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cum[mid] as number) <= f) lo = mid;
    else hi = mid;
  }
  const c0 = cum[lo] as number;
  const h = (cum[lo + 1] as number) - c0;
  if (!(h > 1e-12)) return lo / SAMPLES;
  const t = (f - c0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const y = (2 * t3 - 3 * t2 + 1) * lo + (3 * t2 - 2 * t3) * (lo + 1);
  const m = (t3 - 2 * t2 + t) * (slope[lo] as number) + (t3 - t2) * (slope[lo + 1] as number);
  return Math.min(1, Math.max(0, y / SAMPLES + m * h));
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
  const { wps, len, cum, slope } = path;
  const N = wps.length - 1;
  const at = [0];
  durs.forEach((d) => at.push((at.at(-1) as number) + d));
  const total = at[N] as number;
  const dur = (i: number): number => durs[i] as number;
  // du/df where segment i starts and ends (the arc table's end slopes), so a rate in u per screen maps
  // to the profile's end slope m = rate × dur / (du/df).
  const du0 = (i: number): number => (slope[i] as number[])[0] as number;
  const du1 = (i: number): number => (slope[i] as number[])[SAMPLES] as number;
  const mean = len.map((l, i) => l / dur(i));
  /** du/dt at each waypoint, shared by both segments that meet there. */
  const rate = wps.map((w, k) => {
    if (k === 0 || k === N) return 0;
    if (w.hold) {
      // Arrive moving at a share of the push-in's pace (never above ARRIVE of the approach's own mean
      // pace, so a long dive still decelerates); the end of a hold is left from rest.
      return wps[k + 1]?.name === `${w.name}:end` ? Math.min(DRIFT / dur(k), (ARRIVE * du1(k - 1)) / dur(k - 1)) : 0;
    }
    const sp = 0.8 * Math.min(mean[k - 1] as number, mean[k] as number);
    const sides = [k - 1, k].filter((i) => (len[i] as number) > 1e-9);
    return sides.length < 2 ? 0 : Math.min(sp * du1(k - 1) / (len[k - 1] as number), sp * du0(k) / (len[k] as number));
  });
  const endSlope = (v: number, i: number, du: number): number => (du > 1e-9 ? (v * dur(i)) / du : 0);
  // Cap the profile's end slopes at 3 (no overshoot of the arc fraction) by lowering the shared rate.
  rate.forEach((v, k) => {
    if (k === 0 || k === N) return;
    const worst = Math.max(endSlope(v, k - 1, du1(k - 1)), endSlope(v, k, du0(k)));
    if (worst > 3) rate[k] = (v * 3) / worst;
  });
  const slopes = len.map((_, i) => [endSlope(rate[i] as number, i, du0(i)), endSlope(rate[i + 1] as number, i, du1(i))] as const);
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
    return path.pose(i, paramAt(cum[i] as number[], slope[i] as number[], profile(i, s)));
  };
  const camera = (t: number): LandingState['camera'] => {
    const c = pose(t);
    const target: Vec3 = [c.position[0] + c.fwd[0] * c.dist, c.position[1] + c.fwd[1] * c.dist, c.position[2] + c.fwd[2] * c.dist];
    return { position: c.position, target, fovDeg: c.fovDeg, rollDeg: c.rollDeg };
  };
  return { at, total, pose, camera };
}
