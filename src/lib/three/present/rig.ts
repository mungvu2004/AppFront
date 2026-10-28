/**
 * The rig numbers of a cutaway camera and its sway — plain arithmetic, no `three`.
 *
 * Split out of `director.ts` so a screen that only needs the rig's numbers
 * (the violation figure's resting heading and margin) does not pull `three`
 * into its route chunk; `director.ts` re-exports all of it.
 */

import { AMBIENT_LOOP_MS } from '@/lib/motion';

/* -------------------------------------------------------------------------- */
/* The rig.                                                                    */
/* -------------------------------------------------------------------------- */

/** The numbers a cutaway camera is made of. All optional; the defaults are the tuned ones. */
export interface CameraRig {
  /** How steeply the camera looks down, in radians above the horizon. */
  readonly elevationRad: number;
  /** The heading the model rests at, as a fraction of a turn. */
  readonly restingTurn: number;
  /** How far either side of rest the sway reaches, as a fraction of a turn. */
  readonly swayTurn: number;
  /** One full sway, out and back, in whole ambient beats. */
  readonly swayBeats: number;
  /** Air left around the model once framed, as a factor of its extent. */
  readonly margin: number;
}

const FULL_TURN_RADIANS = Math.PI * 2;

/** Fifty degrees: steep enough to read the plan, low enough that the walls have faces. */
const DEFAULT_ELEVATION_RAD = (50 * Math.PI) / 180;

/** The tuned defaults, balcony to the front-left, eighteen degrees of sway each way. */
export const DEFAULT_CAMERA_RIG: CameraRig = {
  elevationRad: DEFAULT_ELEVATION_RAD,
  restingTurn: 0.05,
  swayTurn: 0.05,
  swayBeats: 30,
  margin: 1.03,
};

/** A rig with the defaults filled in. */
export function resolveRig(overrides: Partial<CameraRig> = {}): CameraRig {
  return { ...DEFAULT_CAMERA_RIG, ...overrides };
}

/* -------------------------------------------------------------------------- */
/* The sway.                                                                   */
/* -------------------------------------------------------------------------- */

/** How long one sway takes, out and back. */
export function swayPeriodMs(rig: CameraRig): number {
  return AMBIENT_LOOP_MS * rig.swayBeats;
}

/** The model's heading at a moment in the sway, in radians about the vertical. */
export function headingAt(rig: CameraRig, elapsedMs: number): number {
  const period = swayPeriodMs(rig);
  const phase = ((elapsedMs % period) + period) % period;
  const fraction = phase / period;

  return (rig.restingTurn + rig.swayTurn * Math.sin(fraction * FULL_TURN_RADIANS)) * FULL_TURN_RADIANS;
}

/** The heading the model parks at when motion is switched off. */
export function restingHeading(rig: CameraRig): number {
  return rig.restingTurn * FULL_TURN_RADIANS;
}
