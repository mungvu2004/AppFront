/**
 * The motion budget (aesthetic/motion.md §3): comfort limits per screen of
 * scroll, and `autoTime`, which gives every camera move the fewest screens that
 * keep each sampled step inside them. The track length is the sum — it falls
 * out of the shot list instead of being picked by hand, so a longer house or a
 * new shot lengthens the page rather than speeding the camera up.
 *
 * Limits are peaks, not means: the rig is sampled densely and a segment is
 * stretched until its worst step passes, at every reference aspect (one
 * schedule serves all, so the scroll length never depends on the window).
 */

import { LANDING_HOUSE } from '../house';

import { angleBetween, expand, makePath, makeRig, relStep, type Path, type Pose } from './rig';
import type { ShotKey } from './shots';

export const LIMITS = {
  /** Look rotation, degrees per screen, outside the building / inside it. */
  outsideDeg: 30,
  insideDeg: 22,
  /** Camera travel per screen: metres inside; outside, look distances (rig.relStep: dolly as |Δd|/d,
   * sideways travel relative to d), so a long-lens camera 80 m out may travel far while a close one may
   * not. 0.8 ≈ Casa Serra's exterior pace. */
  insideM: 2.5,
  outsideRel: 0.8,
  /** Lens change, degrees per screen. */
  fovDeg: 6,
} as const;

/** 16:10 desktop, 16:9, 4:3 and 3:4 tablets: the aspects one schedule must satisfy. */
export const REF_ASPECTS: readonly number[] = [16 / 10, 16 / 9, 4 / 3, 3 / 4];
/** A pass-through move never gets less than this. */
const MIN_MOVE = 0.15;
const STEPS = 96;
const MARGIN = 1.03;

const walls = LANDING_HOUSE.plan.walls;
const levelTop = new Map(LANDING_HOUSE.plan.levels.map((l) => [l.id, (l.elevationMm + l.heightMm) / 1000]));
const xs = walls.flatMap((w) => [w.start[0] ?? 0, w.end[0] ?? 0]).map((v) => v / 1000);
const zs = walls.flatMap((w) => [w.start[1] ?? 0, w.end[1] ?? 0]).map((v) => v / 1000);
const BOUNDS = {
  x0: Math.min(...xs),
  x1: Math.max(...xs),
  z0: Math.min(...zs),
  z1: Math.max(...zs),
  top: Math.max(...walls.map((w) => levelTop.get(w.levelId) ?? 3)),
};

/** Steeper than this the look is a cutaway view over the walls, not a walk. */
const WALK_PITCH = (20 * Math.PI) / 180;

/** Walking inside: in the footprint, under the top, looking roughly level. The stricter limits apply. */
export function isInside(p: readonly number[], fwd: readonly number[] = [0, 0, 1]): boolean {
  const [x = 0, y = 0, z = 0] = p;
  const level = Math.abs(fwd[1] ?? 0) < Math.sin(WALK_PITCH);
  return level && x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1 && y < BOUNDS.top;
}

export interface Rates {
  readonly deg: number;
  readonly m: number;
  /** Travel as a share of the look distance. */
  readonly rel: number;
  readonly fov: number;
  readonly inside: boolean;
}

/** Per-screen rates of the step a → b that took `dScreens`. */
export function rates(a: Pose, b: Pose, dScreens: number): Rates {
  const d = dScreens > 0 ? dScreens : 1e-9;
  const m = Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]);
  return {
    deg: (angleBetween(a.fwd, b.fwd) * 180) / Math.PI / d,
    m: m / d,
    rel: relStep(a, b) / d,
    fov: Math.abs(b.fovDeg - a.fovDeg) / d,
    inside: isInside(a.position, a.fwd) || isInside(b.position, b.fwd),
  };
}

/** How far over budget a step is: ≤ 1 passes. */
export function load(r: Rates): number {
  return Math.max(
    r.deg / (r.inside ? LIMITS.insideDeg : LIMITS.outsideDeg),
    r.inside ? r.m / LIMITS.insideM : r.rel / LIMITS.outsideRel,
    r.fov / LIMITS.fovDeg,
  );
}

export interface Schedule {
  /** Waypoint names (holds expanded into `name` + `name:end`, orbits into `name<k`). */
  readonly names: readonly string[];
  /** Screens per segment, and the screen time each waypoint is reached. */
  readonly durs: readonly number[];
  readonly at: readonly number[];
  readonly total: number;
}

/** Worst load per segment for one timed path. */
function segmentLoads(path: Path, durs: readonly number[]): number[] {
  const rig = makeRig(path, durs);
  return durs.map((dur, i) => {
    const t0 = rig.at[i] as number;
    let prev = rig.pose(t0);
    let worst = 0;
    for (let k = 1; k <= STEPS; k += 1) {
      const q = rig.pose(t0 + (dur * k) / STEPS);
      worst = Math.max(worst, load(rates(prev, q, dur / STEPS)));
      prev = q;
    }
    return worst;
  });
}

/**
 * The fewest screens per move that keep the camera inside LIMITS at every reference aspect, never below a
 * key's authored `min` (holds: their authored length, ≥ 0.4). Iterates because a segment's pass-through
 * speeds depend on its neighbours' timing.
 */
export function autoTime(keys: readonly ShotKey[], aspects: readonly number[] = REF_ASPECTS): Schedule {
  const paths = aspects.map((a) => makePath(expand(keys, a)));
  const wps = (paths[0] as Path).wps;
  let durs = wps.slice(1).map((w) => Math.max(MIN_MOVE, w.min));
  for (let iter = 0; iter < 24; iter += 1) {
    const worst = durs.map(() => 0);
    for (const path of paths) {
      segmentLoads(path, durs).forEach((v, i) => {
        worst[i] = Math.max(worst[i] as number, v);
      });
    }
    if (worst.every((v) => v <= 1)) break;
    durs = durs.map((d, i) => ((worst[i] as number) > 1 ? d * (worst[i] as number) * MARGIN : d));
  }
  const at = [0];
  durs.forEach((d) => at.push((at.at(-1) as number) + d));
  return { names: wps.map((w) => w.name), durs, at, total: at.at(-1) as number };
}
