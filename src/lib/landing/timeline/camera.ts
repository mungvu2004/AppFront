/**
 * The camera at scroll `p`: the shot list (shots.ts), timed once by the motion
 * budget (budget.ts → `SCHEDULE`, in screens), resolved per viewport aspect
 * (framing.ts) and driven through the rig (rig.ts: position spline, yaw/pitch
 * orientation, own FOV/roll channels, speed profile).
 *
 * One schedule serves every aspect, so `p` ↔ screens is fixed; one rig is cached
 * per aspect rounded to 0.01, so the same p and aspect always give the same camera.
 */

import type { LandingState } from '../types';

import { autoTime } from './budget';
import { DEFAULT_ASPECT } from './framing';
import { clamp01, expand, makePath, makeRig, type Rig, type Waypoint } from './rig';
import { SHOTS } from './shots';

export type { Waypoint } from './rig';

export const SCHEDULE = autoTime(SHOTS);

/** Scroll distance from p 0 to p 1, in viewport heights (the pinned track is this + 1 viewport tall). */
export const TRACK_SCREENS: number = SCHEDULE.total;

export interface TimedWaypoint extends Waypoint {
  /** Scroll fraction and screen time at which the camera reaches it. */
  readonly p: number;
  readonly screen: number;
}

const timed = (wps: readonly Waypoint[]): TimedWaypoint[] =>
  wps.map((w, i) => ({ ...w, screen: SCHEDULE.at[i] as number, p: (SCHEDULE.at[i] as number) / TRACK_SCREENS }));

/** The resolved, timed waypoints at the default 16:10. */
export const WAYPOINTS: readonly TimedWaypoint[] = timed(expand(SHOTS, DEFAULT_ASPECT));

const INDEX = new Map(SCHEDULE.names.map((n, i) => [n, i]));

/** Screen time the camera reaches waypoint `name` (throws on an unknown name: anchors must exist). */
export function arrive(name: string): number {
  const i = INDEX.get(name);
  if (i === undefined) throw new RangeError(`unknown waypoint ${name}`);
  return SCHEDULE.at[i] as number;
}

/** Screen time the camera leaves `name`: the end of its hold, or its arrival for a pass-through. */
export const leave = (name: string): number => (INDEX.has(`${name}:end`) ? arrive(`${name}:end`) : arrive(name));

const rigs = new Map<number, Rig>();

/** The camera at scroll `p` for a viewport of `aspect` = width / height (16:10 by default). */
export function cameraAt(p: number, aspect: number = DEFAULT_ASPECT): LandingState['camera'] {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.round(Math.min(4, Math.max(0.3, aspect)) * 100) / 100 : DEFAULT_ASPECT;
  let rig = rigs.get(a);
  if (rig === undefined) {
    if (rigs.size > 16) rigs.clear();
    rig = makeRig(makePath(expand(SHOTS, a)), SCHEDULE.durs);
    rigs.set(a, rig);
  }
  return rig.camera(clamp01(p) * TRACK_SCREENS);
}
