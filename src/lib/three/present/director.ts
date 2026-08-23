/**
 * The camera rig of a cutaway: where it looks from, how it sways, what it frames.
 *
 * A 3D floor plan is shown the way an estate agent shows one — from high up,
 * in parallel projection, with the open side towards the viewer. Three numbers
 * describe that and this module owns all three:
 *
 * - **Elevation.** How steeply the camera looks down. Higher shows more floor;
 *   lower shows more wall. The rule of thumb, for a plan with walls of height
 *   `h` seen at elevation `e`, is that a wall hides `h / tan(e)` of floor behind
 *   it — at 2,4 m and 55° that is 1,7 m, which every room here survives.
 * - **Heading.** The model sways rather than turns. A cutaway has a front — the
 *   side its rooms open towards — and a full turn would spend half its time on
 *   the closed backs of the exterior walls. The sway is a sine about the resting
 *   heading, paced in whole ambient beats so rule B holds.
 * - **Framing.** The frustum is fitted to the sway, not to a bounding sphere:
 *   every corner of the bounding box is swung through the arc and projected
 *   onto the camera's axes, and the furthest reach either way is what has to
 *   fit. That is the difference between a flat that fills its frame and one
 *   that floats in the middle of it.
 *
 * Everything here is arithmetic on a box and a clock. The renderer is somebody
 * else's problem, which is why all of it can be tested without one.
 */

import { Vector3, type Box3, type OrthographicCamera } from 'three';

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

/** Fifty-five degrees: the axonometric tilt a 3D floor plan is usually drawn at. */
const DEFAULT_ELEVATION_RAD = (55 * Math.PI) / 180;

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

/* -------------------------------------------------------------------------- */
/* Framing.                                                                    */
/* -------------------------------------------------------------------------- */

/** How many headings across the sway are tried when fitting the frame. */
const FRAMING_SAMPLES = 24;

/** The half-width and half-height a model needs on screen, in scene units. */
export interface FrameExtents {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** The camera's up vector on screen, for a camera on the `+z` side looking down at `elevation`. */
export function screenUp(elevationRad: number): Vector3 {
  return new Vector3(0, Math.cos(elevationRad), -Math.sin(elevationRad));
}

/**
 * The reach of a bounding box on screen over the whole sway.
 *
 * Every corner is swung through each sampled heading about `centre` and
 * projected onto the camera's right and up axes; the largest reach either way
 * is what the frustum has to cover.
 */
export function swayExtents(bounds: Box3, centre: Vector3, rig: CameraRig): FrameExtents {
  const vertical = new Vector3(0, 1, 0);
  const up = screenUp(rig.elevationRad);
  const corner = new Vector3();
  let halfWidth = 0;
  let halfHeight = 0;

  for (let sample = 0; sample <= FRAMING_SAMPLES; sample += 1) {
    const heading =
      (rig.restingTurn + rig.swayTurn * Math.sin((sample / FRAMING_SAMPLES) * FULL_TURN_RADIANS)) *
      FULL_TURN_RADIANS;

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          corner.set(x, y, z).sub(centre).applyAxisAngle(vertical, heading);
          halfWidth = Math.max(halfWidth, Math.abs(corner.x));
          halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));
        }
      }
    }
  }

  return { halfWidth, halfHeight };
}

/** The frustum half-sizes that fit `extents` into a viewport of `aspect`, with the rig's margin. */
export function fitFrustum(extents: FrameExtents, aspect: number, rig: CameraRig): FrameExtents {
  const widthLimited = extents.halfWidth / extents.halfHeight > aspect;
  const halfWidth = widthLimited
    ? extents.halfWidth * rig.margin
    : extents.halfHeight * rig.margin * aspect;

  return { halfWidth, halfHeight: halfWidth / aspect };
}

/** Apply a fitted frustum to an orthographic camera. */
export function applyFrustum(camera: OrthographicCamera, frustum: FrameExtents): void {
  camera.left = -frustum.halfWidth;
  camera.right = frustum.halfWidth;
  camera.top = frustum.halfHeight;
  camera.bottom = -frustum.halfHeight;
  camera.updateProjectionMatrix();
}

/** Where the camera stands, `distance` away along the rig's elevation, looking at the origin. */
export function cameraPosition(rig: CameraRig, distance: number): Vector3 {
  return new Vector3(0, distance * Math.sin(rig.elevationRad), distance * Math.cos(rig.elevationRad));
}
