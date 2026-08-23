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

import { Vector3, type Box3, type OrthographicCamera, type PerspectiveCamera } from 'three';

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

/* -------------------------------------------------------------------------- */
/* Framing.                                                                    */
/* -------------------------------------------------------------------------- */

/** How many headings across the sway are tried when fitting the frame. */
const FRAMING_SAMPLES = 24;

/** The half-width and half-height a model needs on screen, in scene units. */
export interface FrameExtents {
  readonly halfWidth: number;
  readonly halfHeight: number;
  /**
   * The same reach as a ratio to the distance from the camera, for a
   * perspective camera: the largest `|x| / depth` and `|up| / depth` over every
   * corner, where depth is how far in front of the camera the corner sits.
   * Absent when the extents were measured for an orthographic camera alone.
   */
  readonly tanHalfWidth?: number;
  readonly tanHalfHeight?: number;
}

/** The camera's up vector on screen, for a camera on the `+z` side looking down at `elevation`. */
export function screenUp(elevationRad: number): Vector3 {
  return new Vector3(0, Math.cos(elevationRad), -Math.sin(elevationRad));
}

/** Every corner of `bounds`, swung about `centre` through each sampled heading of the sway. */
function forEachSwayCorner(bounds: Box3, centre: Vector3, rig: CameraRig, visit: (corner: Vector3) => void): void {
  const vertical = new Vector3(0, 1, 0);
  const corner = new Vector3();

  for (let sample = 0; sample <= FRAMING_SAMPLES; sample += 1) {
    const heading =
      (rig.restingTurn + rig.swayTurn * Math.sin((sample / FRAMING_SAMPLES) * FULL_TURN_RADIANS)) *
      FULL_TURN_RADIANS;

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          corner.set(x, y, z).sub(centre).applyAxisAngle(vertical, heading);
          visit(corner);
        }
      }
    }
  }
}

/**
 * The reach of a bounding box on screen over the whole sway.
 *
 * Every corner is swung through each sampled heading about `centre` and
 * projected onto the camera's right and up axes; the largest reach either way
 * is what the frustum has to cover. Given a `cameraDistance`, the perspective
 * ratios are measured too, relative to `aim` — the point on the view axis the
 * camera is pointed at, in the model's centred frame.
 */
export function swayExtents(
  bounds: Box3,
  centre: Vector3,
  rig: CameraRig,
  cameraDistance = 0,
  aim: Vector3 = new Vector3(),
): FrameExtents {
  const up = screenUp(rig.elevationRad);
  const towardsCamera = screenForward(rig.elevationRad);
  const offset = new Vector3();
  let halfWidth = 0;
  let halfHeight = 0;
  let tanHalfWidth = 0;
  let tanHalfHeight = 0;

  forEachSwayCorner(bounds, centre, rig, (corner) => {
    halfWidth = Math.max(halfWidth, Math.abs(corner.x));
    halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));

    if (cameraDistance > 0) {
      // A corner nearer the camera than the aim looms larger.
      offset.copy(corner).sub(aim);
      const depth = Math.max(cameraDistance * 0.1, cameraDistance - offset.dot(towardsCamera));
      tanHalfWidth = Math.max(tanHalfWidth, Math.abs(offset.x) / depth);
      tanHalfHeight = Math.max(tanHalfHeight, Math.abs(offset.dot(up)) / depth);
    }
  });

  return cameraDistance > 0 ? { halfWidth, halfHeight, tanHalfWidth, tanHalfHeight } : { halfWidth, halfHeight };
}

/**
 * Where a perspective camera should aim so the model sits centred on screen.
 *
 * Seen in perspective, the near half of a model is bigger than the far half,
 * so a camera aimed at the model's centre leaves a band of empty frame above
 * it. This measures the signed reach up and down the screen over the sway and
 * returns the point, along the screen's up axis, that splits it evenly — the
 * camera is then moved by this offset, not tilted, so the elevation holds.
 */
export function frameAim(bounds: Box3, centre: Vector3, rig: CameraRig, cameraDistance: number): Vector3 {
  const up = screenUp(rig.elevationRad);
  const towardsCamera = screenForward(rig.elevationRad);
  let top = -Infinity;
  let bottom = Infinity;

  forEachSwayCorner(bounds, centre, rig, (corner) => {
    const depth = Math.max(cameraDistance * 0.1, cameraDistance - corner.dot(towardsCamera));
    const ratio = corner.dot(up) / depth;
    top = Math.max(top, ratio);
    bottom = Math.min(bottom, ratio);
  });

  return up.multiplyScalar((cameraDistance * (top + bottom)) / 2);
}

/** The unit vector from the origin towards the camera, for a camera on the `+z` side at `elevation`. */
export function screenForward(elevationRad: number): Vector3 {
  return new Vector3(0, Math.sin(elevationRad), Math.cos(elevationRad));
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

/**
 * The vertical field of view, in degrees, that fits `extents` into a viewport
 * of `aspect` for a perspective camera, with the rig's margin.
 *
 * Uses the perspective ratios when the extents carry them, so a corner that
 * leans towards the camera still lands inside the frame; otherwise falls back
 * to the orthographic reach over `cameraDistance`, which is right only for a
 * model thin along the view axis.
 */
export function fitFieldOfView(extents: FrameExtents, aspect: number, rig: CameraRig, cameraDistance: number): number {
  const tanHalfWidth = extents.tanHalfWidth ?? extents.halfWidth / cameraDistance;
  const tanHalfHeight = extents.tanHalfHeight ?? extents.halfHeight / cameraDistance;
  const tanHalfVertical = Math.max(tanHalfHeight, tanHalfWidth / aspect) * rig.margin;

  return (2 * Math.atan(tanHalfVertical) * 180) / Math.PI;
}

/** Apply a fitted field of view to a perspective camera. */
export function applyFieldOfView(camera: PerspectiveCamera, fovDeg: number, aspect: number): void {
  camera.fov = fovDeg;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}

/** Where the camera stands, `distance` away along the rig's elevation, looking at the origin. */
export function cameraPosition(rig: CameraRig, distance: number): Vector3 {
  return new Vector3(0, distance * Math.sin(rig.elevationRad), distance * Math.cos(rig.elevationRad));
}
