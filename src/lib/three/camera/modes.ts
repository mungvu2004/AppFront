/**
 * Three ways of looking at a building, and the one thing all three agree about.
 *
 * A reviewer does three different things with a model and needs a different
 * camera for each: turn it over to see how it is put together, read it flat to
 * check a dimension, and stand inside it to find out whether a door opens into a
 * corridor somebody can actually use. Those are the orbit, top and walk modes.
 *
 * ## Why these are written out rather than configured
 *
 * `OrbitControls` and `PointerLockControls` ship with drei, and using either as
 * it comes would put the numbers that decide how this product feels inside a
 * dependency: the damping factor, the angle limits, the walking speed, the
 * key map. This module reimplements what it needs so that every one of those
 * numbers is a field of {@link CAMERA_SETTINGS}, reviewable in one diff and
 * assertable in one test. Nothing here listens to the DOM, holds a renderer or
 * reads a store — a mode takes pointer deltas, key codes and a `dt`, and reports
 * where the camera is. That is what makes the whole file testable without a
 * canvas.
 *
 * ## The viewpoint is the currency
 *
 * Switching mode must not throw the reviewer somewhere else in the building.
 * The three modes cannot agree about where the *camera* goes — a walker's eye is
 * pinned 1,6 m off the floor, an orthographic plan view has no meaningful eye
 * distance at all — but they can agree about **the point being looked at**. So
 * {@link Viewpoint} is that point, plus the heading, vertical angle and framing
 * distance around it, and every mode can be built from one and can produce one.
 *
 * The promise {@link switchCameraMode} keeps is therefore exact and measurable:
 * **the point being looked at does not move.** What moves is where the camera
 * stands to look at it, which is the difference between the modes and the reason
 * the reviewer asked to switch. Coming from the top view, the walker is put down
 * on the spot they were looking at; coming from the walk, the orbit camera lifts
 * off the ground while keeping the same wall in the middle of the screen.
 *
 * ## Conventions
 *
 * Everything is in **metres** — scene units, per `build/scene.ts`. Angles inside
 * this file are radians; {@link CAMERA_SETTINGS} states them in degrees and they
 * are converted once, at the top, through the domain's own converter.
 *
 * Spherical angles follow three.js exactly, so the two can be cross-read:
 * `polarRad` is measured **down from +Y** — 0 is straight down over the target,
 * 90° is level with it — and `azimuthRad` turns from +Z towards +X. The eye of a
 * viewpoint is
 *
 * ```text
 * eye = target + r · (sin φ · sin θ,  cos φ,  sin φ · cos θ)
 * ```
 *
 * The walk mode's pitch is the same angle stated the way a person would: `pitch
 * = φ − 90°`, positive looking up. The orbit limits of 5° and 85° are therefore
 * pitches of −85° and −5°, which is the same statement — the camera always looks
 * down at the building, between a steep view and a nearly level one.
 */

import { Vector3, type Box3, type OrthographicCamera, type PerspectiveCamera } from 'three';

import { degrees, degreesToRadians, RADIANS_PER_TURN } from '@/domain/units/types';

import { CAMERA_SETTINGS } from './settings';

/* -------------------------------------------------------------------------- */
/* Angles, resolved once from the settings.                                    */
/* -------------------------------------------------------------------------- */

/** Degrees to radians, through the domain converter rather than a local π/180. */
function toRadians(value: number): number {
  return degreesToRadians(degrees(value));
}

const QUARTER_TURN_RAD = RADIANS_PER_TURN / 4;

const ORBIT_MIN_POLAR_RAD = toRadians(CAMERA_SETTINGS.orbit.minPolarDeg);
const ORBIT_MAX_POLAR_RAD = toRadians(CAMERA_SETTINGS.orbit.maxPolarDeg);
const ORBIT_RAD_PER_PIXEL = RADIANS_PER_TURN / CAMERA_SETTINGS.orbit.rotatePixelsPerTurn;

const TOP_POLAR_RAD = toRadians(CAMERA_SETTINGS.top.polarDeg);

const WALK_MAX_PITCH_RAD = toRadians(CAMERA_SETTINGS.walk.maxPitchDeg);
const WALK_RAD_PER_PIXEL = RADIANS_PER_TURN / CAMERA_SETTINGS.walk.lookPixelsPerTurn;

/** Half the vertical field of view: the exchange rate between the two projections. */
const HALF_FIELD_OF_VIEW_RAD = toRadians(CAMERA_SETTINGS.shared.fieldOfViewDeg / 2);

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** Which of the three ways of looking is in use. */
export type CameraMode = 'orbit' | 'top' | 'walk';

/**
 * What every mode can say, and every mode can be built from.
 *
 * The handover currency. `target` is the point on the model being looked at, and
 * it is the part {@link switchCameraMode} guarantees; the other three describe
 * how the camera is arranged around it, and a mode is free to adjust them to fit
 * its own rules.
 */
export interface Viewpoint {
  /** The point being looked at, in metres. */
  readonly target: Vector3;
  /** Heading around +Y, from +Z towards +X. Not folded into one turn. */
  readonly azimuthRad: number;
  /** Angle down from +Y: 0 is straight down over the target, 90° is level. */
  readonly polarRad: number;
  /**
   * Framing distance, in metres.
   *
   * For the orbit and walk modes this is the eye's real distance to the target.
   * For the top mode, whose projection has no such distance, it is how far away a
   * perspective camera with the shared field of view would stand to frame the
   * same width — which is what makes a round trip through the top view keep the
   * building the same size on screen.
   */
  readonly distanceM: number;
}

/** Where the camera is this instant, ready to be written onto a three camera. */
export interface CameraPose {
  readonly eye: Vector3;
  readonly target: Vector3;
  /** Which way is up on screen. Not always +Y: a top view has to lie down. */
  readonly up: Vector3;
  /** Half the visible height in metres for an orthographic view; `null` for perspective. */
  readonly orthographicHalfHeightM: number | null;
}

/**
 * How big the thing being looked at is.
 *
 * Passed in rather than measured from a scene, so a mode can be driven by a
 * plan's bounding box before any geometry exists — and so this module never
 * needs to walk an `Object3D`.
 */
export interface BuildingExtent {
  readonly centre: Vector3;
  /** Width along x, height along y, depth along z, in metres. */
  readonly sizeM: Vector3;
}

/** A closed range of lengths, in metres. */
export interface LengthLimits {
  readonly minM: number;
  readonly maxM: number;
}

/** Near and far clip planes, in metres. */
export interface ClipPlanes {
  readonly nearM: number;
  readonly farM: number;
}

/**
 * Everything a mode needs that is not the viewpoint.
 *
 * Supplied by the caller on every construction. The modes hold no module state
 * and read no store; a screen that owns a project passes its extent down, and a
 * test passes a box it made up.
 */
export interface CameraModeContext {
  readonly extent: BuildingExtent;
  /**
   * The floor the walker stands on, in metres. Defaults to the bottom of the
   * extent, which is the ground storey of whatever was handed in.
   */
  readonly floorElevationM?: number;
}

/** A camera you can drive. The three modes differ in their inputs, not in this. */
export interface CameraModeController {
  readonly mode: CameraMode;
  /** The viewpoint as it is right now — mid-damping, not where it is heading. */
  viewpoint(): Viewpoint;
  /** Where the camera is right now. */
  pose(): CameraPose;
  /**
   * Advance by `dtSeconds`.
   *
   * @returns whether anything moved, so a caller can stop redrawing a still scene.
   */
  update(dtSeconds: number): boolean;
  /** Arrive immediately: drop the damping tail and sit on the goal. */
  settle(): void;
  /** Write the current pose onto a three camera, projection included. */
  applyTo(camera: PerspectiveCamera | OrthographicCamera, aspect: number): void;
}

/* -------------------------------------------------------------------------- */
/* Geometry helpers.                                                           */
/* -------------------------------------------------------------------------- */

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** The eye's offset from its target, in the three.js spherical convention. */
function eyeOffset(azimuthRad: number, polarRad: number, distanceM: number): Vector3 {
  const sinPolar = Math.sin(polarRad);
  return new Vector3(
    distanceM * sinPolar * Math.sin(azimuthRad),
    distanceM * Math.cos(polarRad),
    distanceM * sinPolar * Math.cos(azimuthRad),
  );
}

/**
 * The horizontal direction the camera faces at this heading.
 *
 * The negative of the eye's horizontal offset: the eye stands behind the target
 * and looks towards it. At heading 0 this is `(0, 0, −1)`, which is where an
 * untouched three camera points, so the two conventions line up.
 */
function horizontalForward(azimuthRad: number): Vector3 {
  return new Vector3(-Math.sin(azimuthRad), 0, -Math.cos(azimuthRad));
}

/** Screen right at this heading — always horizontal, whatever the vertical angle. */
function horizontalRight(azimuthRad: number): Vector3 {
  return new Vector3(Math.cos(azimuthRad), 0, -Math.sin(azimuthRad));
}

/**
 * Screen up in world space.
 *
 * `cross(right, forward)` worked through for the spherical frame. At 90° it is
 * `(0, 1, 0)`; at 0° — straight down, where world up is parallel to the view and
 * useless — it degrades gracefully into {@link horizontalForward}, which is
 * exactly the up vector a top view needs.
 */
function screenUp(azimuthRad: number, polarRad: number): Vector3 {
  const cosPolar = Math.cos(polarRad);
  return new Vector3(
    -cosPolar * Math.sin(azimuthRad),
    Math.sin(polarRad),
    -cosPolar * Math.cos(azimuthRad),
  );
}

/**
 * How much of the world one pixel covers, for a perspective view at this distance.
 *
 * Zero when the viewport has no height — a collapsed panel reports one — so that
 * a drag over nothing moves nothing rather than dividing by it.
 */
function perspectiveMetresPerPixel(distanceM: number, viewportHeightPx: number): number {
  if (!Number.isFinite(viewportHeightPx) || viewportHeightPx <= 0) {
    return 0;
  }
  return (2 * distanceM * Math.tan(HALF_FIELD_OF_VIEW_RAD)) / viewportHeightPx;
}

/** The same, for an orthographic view showing this half-height. */
function orthographicMetresPerPixel(halfHeightM: number, viewportHeightPx: number): number {
  if (!Number.isFinite(viewportHeightPx) || viewportHeightPx <= 0) {
    return 0;
  }
  return (2 * halfHeightM) / viewportHeightPx;
}

/**
 * The fraction of the way to the goal to travel in `dtSeconds`.
 *
 * `damping` is quoted per 1/60 s, so the decay is raised to the number of such
 * frames the step really was. A 30 Hz frame therefore covers exactly what two
 * 60 Hz frames would, and a scene that stutters does not also change feel.
 */
function dampingAlpha(damping: number, dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return 0;
  }
  const frames = dtSeconds * CAMERA_SETTINGS.shared.dampingReferenceHz;
  return 1 - Math.pow(1 - damping, frames);
}

/* -------------------------------------------------------------------------- */
/* The building, and the limits it sets.                                       */
/* -------------------------------------------------------------------------- */

/** An extent from a bounding box, which is how a built scene reports its size. */
export function buildingExtent(box: Box3): BuildingExtent {
  return {
    centre: new Vector3(
      (box.min.x + box.max.x) / 2,
      (box.min.y + box.max.y) / 2,
      (box.min.z + box.max.z) / 2,
    ),
    sizeM: new Vector3(
      Math.max(0, box.max.x - box.min.x),
      Math.max(0, box.max.y - box.min.y),
      Math.max(0, box.max.z - box.min.z),
    ),
  };
}

/** The floor the walk mode stands on by default: the bottom of the extent. */
export function extentFloorM(extent: BuildingExtent): number {
  return extent.centre.y - extent.sizeM.y / 2;
}

/**
 * Radius of the sphere the building fits in, never smaller than
 * {@link SharedCameraSettings.smallestPlanRadiusM}.
 *
 * Every zoom limit below is a multiple of this one number, which is what "limit
 * the zoom to the size of the building" means concretely: a 6 m outbuilding and
 * a 60 m block get the same relationship between the camera and the thing it is
 * pointed at, not the same distances.
 */
export function boundingRadiusM(extent: BuildingExtent): number {
  const half = Math.hypot(extent.sizeM.x, extent.sizeM.y, extent.sizeM.z) / 2;
  return Math.max(half, CAMERA_SETTINGS.shared.smallestPlanRadiusM);
}

/** How near and how far the orbit camera may stand, for a building this size. */
export function orbitDistanceLimits(extent: BuildingExtent): LengthLimits {
  const radius = boundingRadiusM(extent);
  const minM = Math.max(
    CAMERA_SETTINGS.orbit.minDistanceM,
    radius * CAMERA_SETTINGS.orbit.minRadiusFactor,
  );
  return { minM, maxM: Math.max(minM, radius * CAMERA_SETTINGS.orbit.maxRadiusFactor) };
}

/** How far in and out the top view may zoom, as half-heights of the frustum. */
export function topHalfHeightLimits(extent: BuildingExtent): LengthLimits {
  const radius = boundingRadiusM(extent);
  const minM = Math.max(
    CAMERA_SETTINGS.top.minHalfHeightM,
    radius * CAMERA_SETTINGS.top.minHalfHeightFactor,
  );
  return { minM, maxM: Math.max(minM, radius * CAMERA_SETTINGS.top.maxHalfHeightFactor) };
}

/** Clip planes wide enough for the far limit of a building this size. */
export function clipPlanes(extent: BuildingExtent): ClipPlanes {
  return {
    nearM: CAMERA_SETTINGS.shared.nearM,
    farM: Math.max(
      CAMERA_SETTINGS.shared.minFarM,
      boundingRadiusM(extent) * CAMERA_SETTINGS.shared.farRadiusFactor,
    ),
  };
}

/** The perspective distance that frames what an orthographic half-height shows. */
export function frameDistanceM(halfHeightM: number): number {
  return halfHeightM / Math.tan(HALF_FIELD_OF_VIEW_RAD);
}

/** The orthographic half-height that shows what a perspective distance frames. */
export function frameHalfHeightM(distanceM: number): number {
  return distanceM * Math.tan(HALF_FIELD_OF_VIEW_RAD);
}

/** Where the eye of a viewpoint sits. */
export function viewpointEye(viewpoint: Viewpoint): Vector3 {
  return eyeOffset(viewpoint.azimuthRad, viewpoint.polarRad, viewpoint.distanceM).add(
    viewpoint.target,
  );
}

/**
 * The view a project opens on: the whole building, seen from a corner and above.
 *
 * The distance frames the bounding sphere in the vertical field of view, with a
 * margin, and is then held to the same limits every other zoom is — so the first
 * frame of a session cannot start outside the range the rest of the session is
 * confined to.
 */
export function initialViewpoint(extent: BuildingExtent): Viewpoint {
  const limits = orbitDistanceLimits(extent);
  const fitted =
    (boundingRadiusM(extent) / Math.sin(HALF_FIELD_OF_VIEW_RAD)) * CAMERA_SETTINGS.orbit.fitMargin;

  return {
    target: extent.centre.clone(),
    azimuthRad: toRadians(CAMERA_SETTINGS.orbit.initialAzimuthDeg),
    polarRad: toRadians(CAMERA_SETTINGS.orbit.initialPolarDeg),
    distanceM: clamp(fitted, limits.minM, limits.maxM),
  };
}

/* -------------------------------------------------------------------------- */
/* Writing a pose onto a three camera.                                         */
/* -------------------------------------------------------------------------- */

function isOrthographic(
  camera: PerspectiveCamera | OrthographicCamera,
): camera is OrthographicCamera {
  return (camera as OrthographicCamera).isOrthographicCamera === true;
}

/**
 * Put a camera where a pose says, and set the projection to match.
 *
 * The lens comes from the settings rather than from whatever the camera was
 * constructed with, so the field of view a mode assumes when it converts between
 * the two projections is the one actually rendered.
 */
function applyPose(
  camera: PerspectiveCamera | OrthographicCamera,
  pose: CameraPose,
  aspect: number,
  planes: ClipPlanes,
): void {
  camera.position.copy(pose.eye);
  camera.up.copy(pose.up);
  camera.lookAt(pose.target);
  camera.near = planes.nearM;
  camera.far = planes.farM;

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;

  if (isOrthographic(camera)) {
    const halfHeight =
      pose.orthographicHalfHeightM ?? frameHalfHeightM(pose.eye.distanceTo(pose.target));
    const halfWidth = halfHeight * safeAspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
  } else {
    camera.fov = CAMERA_SETTINGS.shared.fieldOfViewDeg;
    camera.aspect = safeAspect;
  }

  camera.updateProjectionMatrix();
}

/* -------------------------------------------------------------------------- */
/* Orbit.                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Turn around the building, looking in.
 *
 * Two copies of the same four numbers: the goal, which the input methods move,
 * and the live values, which chase it at {@link OrbitCameraSettings.damping} a
 * frame. Both are clamped, and the live vertical angle is clamped again after
 * every step, so there is no instant — not mid-flight, not after a thrown
 * pointer, not after a `dt` of a second and a half — at which the camera is
 * outside the 5°–85° band.
 */
export class OrbitCameraMode implements CameraModeController {
  readonly mode = 'orbit';

  private readonly extent: BuildingExtent;
  private readonly limits: LengthLimits;

  private readonly goalTarget = new Vector3();
  private readonly liveTarget = new Vector3();

  private goalAzimuthRad: number;
  private liveAzimuthRad: number;
  private goalPolarRad: number;
  private livePolarRad: number;
  private goalDistanceM: number;
  private liveDistanceM: number;

  constructor(viewpoint: Viewpoint, context: CameraModeContext) {
    this.extent = context.extent;
    this.limits = orbitDistanceLimits(context.extent);

    this.goalTarget.copy(viewpoint.target);
    this.liveTarget.copy(viewpoint.target);

    this.goalAzimuthRad = viewpoint.azimuthRad;
    this.liveAzimuthRad = viewpoint.azimuthRad;
    this.goalPolarRad = clamp(viewpoint.polarRad, ORBIT_MIN_POLAR_RAD, ORBIT_MAX_POLAR_RAD);
    this.livePolarRad = this.goalPolarRad;
    this.goalDistanceM = clamp(viewpoint.distanceM, this.limits.minM, this.limits.maxM);
    this.liveDistanceM = this.goalDistanceM;
  }

  /** The range this camera's distance is held to, for a caller that wants to show it. */
  get distanceLimits(): LengthLimits {
    return this.limits;
  }

  /**
   * Turn, in pointer pixels. Dragging drags the building.
   *
   * Right sends it right; pulling down tips it over so that more of the roof
   * comes into view, which takes the camera towards the 5° end of the band. The
   * same signs `OrbitControls` uses, so a reviewer's hands do not have to be
   * retrained for this viewer.
   *
   * The heading is left unfolded, so a reviewer who spins the model four times
   * gets four turns of damping rather than a jump back through zero.
   */
  rotate(deltaXPx: number, deltaYPx: number): void {
    this.goalAzimuthRad -= deltaXPx * ORBIT_RAD_PER_PIXEL;
    this.goalPolarRad = clamp(
      this.goalPolarRad - deltaYPx * ORBIT_RAD_PER_PIXEL,
      ORBIT_MIN_POLAR_RAD,
      ORBIT_MAX_POLAR_RAD,
    );
  }

  /**
   * Slide the point being looked at across the screen plane.
   *
   * The pixel-to-metre rate is the true one for the current distance, so the
   * model keeps pace with the pointer instead of sliding faster the further away
   * it is.
   */
  pan(deltaXPx: number, deltaYPx: number, viewportHeightPx: number): void {
    const perPixel =
      perspectiveMetresPerPixel(this.liveDistanceM, viewportHeightPx) *
      CAMERA_SETTINGS.orbit.panSpeedFactor;
    if (perPixel === 0) {
      return;
    }

    const right = horizontalRight(this.goalAzimuthRad).multiplyScalar(-deltaXPx * perPixel);
    const up = screenUp(this.goalAzimuthRad, this.goalPolarRad).multiplyScalar(deltaYPx * perPixel);
    this.goalTarget.add(right).add(up);
  }

  /** Wheel notches out and in. The distance stays inside the building's limits. */
  dolly(notches: number): void {
    const scaled = this.goalDistanceM * Math.pow(CAMERA_SETTINGS.orbit.zoomFactorPerNotch, notches);
    this.goalDistanceM = clamp(scaled, this.limits.minM, this.limits.maxM);
  }

  viewpoint(): Viewpoint {
    return {
      target: this.liveTarget.clone(),
      azimuthRad: this.liveAzimuthRad,
      polarRad: this.livePolarRad,
      distanceM: this.liveDistanceM,
    };
  }

  pose(): CameraPose {
    return {
      eye: eyeOffset(this.liveAzimuthRad, this.livePolarRad, this.liveDistanceM).add(
        this.liveTarget,
      ),
      target: this.liveTarget.clone(),
      up: new Vector3(0, 1, 0),
      orthographicHalfHeightM: null,
    };
  }

  update(dtSeconds: number): boolean {
    const alpha = dampingAlpha(CAMERA_SETTINGS.orbit.damping, dtSeconds);
    if (alpha === 0) {
      return !this.atRest();
    }

    this.liveTarget.lerp(this.goalTarget, alpha);
    this.liveAzimuthRad += (this.goalAzimuthRad - this.liveAzimuthRad) * alpha;
    this.livePolarRad = clamp(
      this.livePolarRad + (this.goalPolarRad - this.livePolarRad) * alpha,
      ORBIT_MIN_POLAR_RAD,
      ORBIT_MAX_POLAR_RAD,
    );
    this.liveDistanceM += (this.goalDistanceM - this.liveDistanceM) * alpha;

    if (this.atRest()) {
      this.settle();
      return false;
    }
    return true;
  }

  settle(): void {
    this.liveTarget.copy(this.goalTarget);
    this.liveAzimuthRad = this.goalAzimuthRad;
    this.livePolarRad = this.goalPolarRad;
    this.liveDistanceM = this.goalDistanceM;
  }

  applyTo(camera: PerspectiveCamera | OrthographicCamera, aspect: number): void {
    applyPose(camera, this.pose(), aspect, clipPlanes(this.extent));
  }

  /** Is every channel within a tenth of a millimetre, or its angular equal, of the goal? */
  private atRest(): boolean {
    const epsilon = CAMERA_SETTINGS.shared.restEpsilon;
    return (
      this.liveTarget.distanceTo(this.goalTarget) <= epsilon &&
      Math.abs(this.goalAzimuthRad - this.liveAzimuthRad) <= epsilon &&
      Math.abs(this.goalPolarRad - this.livePolarRad) <= epsilon &&
      Math.abs(this.goalDistanceM - this.liveDistanceM) <= epsilon
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Top.                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The plan, read flat.
 *
 * Orthographic, because a plan is a measured drawing: two walls of the same
 * length must be the same length on screen whichever end of the building they
 * are at, and a perspective view is exactly the thing that breaks that.
 *
 * There is no method here that changes the vertical angle or the heading. The
 * lock is structural rather than a clamp — an input that does not exist cannot be
 * called by mistake — and the heading is the one inherited on entry, so arriving
 * from the orbit view leaves the building pointing the same way on screen as it
 * did a frame earlier.
 */
export class TopCameraMode implements CameraModeController {
  readonly mode = 'top';

  private readonly extent: BuildingExtent;
  private readonly limits: LengthLimits;
  private readonly azimuthRad: number;
  private readonly parkedHeightM: number;

  private readonly goalTarget = new Vector3();
  private readonly liveTarget = new Vector3();

  private goalHalfHeightM: number;
  private liveHalfHeightM: number;

  constructor(viewpoint: Viewpoint, context: CameraModeContext) {
    this.extent = context.extent;
    this.limits = topHalfHeightLimits(context.extent);
    this.azimuthRad = viewpoint.azimuthRad;
    this.parkedHeightM =
      context.extent.centre.y + context.extent.sizeM.y / 2 + CAMERA_SETTINGS.top.clearanceM;

    this.goalTarget.copy(viewpoint.target);
    this.liveTarget.copy(viewpoint.target);

    this.goalHalfHeightM = clamp(
      frameHalfHeightM(viewpoint.distanceM),
      this.limits.minM,
      this.limits.maxM,
    );
    this.liveHalfHeightM = this.goalHalfHeightM;
  }

  /** How far in and out this view may zoom, for a caller that wants to show it. */
  get halfHeightLimits(): LengthLimits {
    return this.limits;
  }

  /** Half the visible height of the plan, in metres — the zoom, stated as a length. */
  get halfHeightM(): number {
    return this.liveHalfHeightM;
  }

  /**
   * Slide the plan under the pointer.
   *
   * Both directions are horizontal, so the height of the point being looked at
   * is untouched however far the reviewer slides: a plan view stays on its
   * storey.
   */
  pan(deltaXPx: number, deltaYPx: number, viewportHeightPx: number): void {
    const perPixel =
      orthographicMetresPerPixel(this.liveHalfHeightM, viewportHeightPx) *
      CAMERA_SETTINGS.top.panSpeedFactor;
    if (perPixel === 0) {
      return;
    }

    const right = horizontalRight(this.azimuthRad).multiplyScalar(-deltaXPx * perPixel);
    const up = horizontalForward(this.azimuthRad).multiplyScalar(deltaYPx * perPixel);
    this.goalTarget.add(right).add(up);
  }

  /** Wheel notches out and in, held to the limits the building size sets. */
  zoom(notches: number): void {
    const scaled = this.goalHalfHeightM * Math.pow(CAMERA_SETTINGS.top.zoomFactorPerNotch, notches);
    this.goalHalfHeightM = clamp(scaled, this.limits.minM, this.limits.maxM);
  }

  viewpoint(): Viewpoint {
    return {
      target: this.liveTarget.clone(),
      azimuthRad: this.azimuthRad,
      polarRad: TOP_POLAR_RAD,
      distanceM: frameDistanceM(this.liveHalfHeightM),
    };
  }

  pose(): CameraPose {
    const eyeY = Math.max(this.parkedHeightM, this.liveTarget.y + CAMERA_SETTINGS.top.clearanceM);
    return {
      eye: new Vector3(this.liveTarget.x, eyeY, this.liveTarget.z),
      target: this.liveTarget.clone(),
      up: screenUp(this.azimuthRad, TOP_POLAR_RAD),
      orthographicHalfHeightM: this.liveHalfHeightM,
    };
  }

  update(dtSeconds: number): boolean {
    const alpha = dampingAlpha(CAMERA_SETTINGS.top.damping, dtSeconds);
    if (alpha === 0) {
      return !this.atRest();
    }

    this.liveTarget.lerp(this.goalTarget, alpha);
    this.liveHalfHeightM += (this.goalHalfHeightM - this.liveHalfHeightM) * alpha;

    if (this.atRest()) {
      this.settle();
      return false;
    }
    return true;
  }

  settle(): void {
    this.liveTarget.copy(this.goalTarget);
    this.liveHalfHeightM = this.goalHalfHeightM;
  }

  applyTo(camera: PerspectiveCamera | OrthographicCamera, aspect: number): void {
    applyPose(camera, this.pose(), aspect, clipPlanes(this.extent));
  }

  private atRest(): boolean {
    const epsilon = CAMERA_SETTINGS.shared.restEpsilon;
    return (
      this.liveTarget.distanceTo(this.goalTarget) <= epsilon &&
      Math.abs(this.goalHalfHeightM - this.liveHalfHeightM) <= epsilon
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Walk.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Standing in the building, at the height of somebody looking at it.
 *
 * The eye is pinned to `floor + 1,6 m` and nothing moves it — not walking, not
 * looking, not a `dt` of any size. A first-person view whose height drifts is a
 * view that cannot answer the question it exists to answer, which is whether a
 * head-height clash is a clash.
 *
 * There is no damping and no acceleration. Held for one second, W covers
 * {@link WalkCameraSettings.walkSpeedMps} metres exactly; with the run key held
 * it covers {@link WalkCameraSettings.runSpeedMps}. A ramp would make both of
 * those "about", and "about 1,4 m" is not a number anybody can check a corridor
 * against.
 *
 * Diagonals are normalised, so holding W and D is not the 41% shortcut it is in
 * a naive implementation.
 */
export class WalkCameraMode implements CameraModeController {
  readonly mode = 'walk';

  private readonly extent: BuildingExtent;
  private readonly floorElevationM: number;
  private readonly pressed = new Set<string>();
  private readonly eye = new Vector3();

  private azimuthRad: number;
  private pitchRad: number;
  private focusDistanceM: number;

  /**
   * Put the walker down without moving what they are looking at.
   *
   * They stand where the previous camera stood, horizontally, but at eye height
   * — so `1,6 m` replaces whatever the height was, and the pitch is whatever now
   * points at the same target. Only when that pitch would be steeper than the
   * mode allows (arriving from the top view, where the target is straight down)
   * is the standing position pulled in instead, close enough that the allowed
   * pitch still reaches the target. Either way the target itself is untouched.
   */
  constructor(viewpoint: Viewpoint, context: CameraModeContext) {
    this.extent = context.extent;
    this.floorElevationM = context.floorElevationM ?? extentFloorM(context.extent);

    const eyeY = this.floorElevationM + CAMERA_SETTINGS.walk.eyeHeightM;
    const rise = viewpoint.target.y - eyeY;

    let horizontalM = Math.max(0, viewpoint.distanceM * Math.sin(viewpoint.polarRad));
    let pitchRad = Math.atan2(rise, horizontalM);
    const clamped = clamp(pitchRad, -WALK_MAX_PITCH_RAD, WALK_MAX_PITCH_RAD);

    if (clamped !== pitchRad) {
      // The clamp and the rise always share a sign here, so this stays positive.
      horizontalM = rise / Math.tan(clamped);
      pitchRad = clamped;
    }

    this.azimuthRad = viewpoint.azimuthRad;
    this.pitchRad = pitchRad;
    this.eye.set(
      viewpoint.target.x + horizontalM * Math.sin(viewpoint.azimuthRad),
      eyeY,
      viewpoint.target.z + horizontalM * Math.cos(viewpoint.azimuthRad),
    );

    const focus = Math.hypot(horizontalM, rise);
    this.focusDistanceM = focus > 0 ? focus : CAMERA_SETTINGS.walk.focusDistanceM;
  }

  /** The floor this walker is on, in metres. */
  get floorM(): number {
    return this.floorElevationM;
  }

  /** How far the view is tilted from horizontal, in radians; positive is up. */
  get pitch(): number {
    return this.pitchRad;
  }

  /** Take a key down. `KeyboardEvent.code`, matched against the settings' bindings. */
  press(code: string): void {
    this.pressed.add(code);
  }

  /** Let a key up. */
  release(code: string): void {
    this.pressed.delete(code);
  }

  /**
   * Let every key up.
   *
   * For a window that loses focus mid-stride: the key-up never arrives, and a
   * walker who keeps walking through a blurred canvas is a bug that only shows
   * up when the reviewer comes back.
   */
  releaseAll(): void {
    this.pressed.clear();
  }

  /** Is the run key down? */
  get running(): boolean {
    return this.anyPressed(CAMERA_SETTINGS.walk.keys.run);
  }

  /** The pace being walked at right now, in metres per second. */
  get speedMps(): number {
    return this.running ? CAMERA_SETTINGS.walk.runSpeedMps : CAMERA_SETTINGS.walk.walkSpeedMps;
  }

  /** Turn and tilt, in pointer pixels. The tilt is held to ±85°. */
  look(deltaXPx: number, deltaYPx: number): void {
    this.azimuthRad -= deltaXPx * WALK_RAD_PER_PIXEL;
    this.pitchRad = clamp(
      this.pitchRad - deltaYPx * WALK_RAD_PER_PIXEL,
      -WALK_MAX_PITCH_RAD,
      WALK_MAX_PITCH_RAD,
    );
  }

  viewpoint(): Viewpoint {
    return {
      target: this.targetPoint(),
      azimuthRad: this.azimuthRad,
      polarRad: this.pitchRad + QUARTER_TURN_RAD,
      distanceM: this.focusDistanceM,
    };
  }

  pose(): CameraPose {
    return {
      eye: this.eye.clone(),
      target: this.targetPoint(),
      up: new Vector3(0, 1, 0),
      orthographicHalfHeightM: null,
    };
  }

  update(dtSeconds: number): boolean {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      return false;
    }

    const keys = CAMERA_SETTINGS.walk.keys;
    const advance = this.axis(keys.forward, keys.back);
    const strafe = this.axis(keys.right, keys.left);
    if (advance === 0 && strafe === 0) {
      return false;
    }

    const step = horizontalForward(this.azimuthRad)
      .multiplyScalar(advance)
      .add(horizontalRight(this.azimuthRad).multiplyScalar(strafe))
      .normalize()
      .multiplyScalar(this.speedMps * dtSeconds);

    this.eye.add(step);
    // Belt and braces: the step is horizontal by construction, and the eye height
    // is the one thing this mode may never lose to accumulated float error.
    this.eye.y = this.floorElevationM + CAMERA_SETTINGS.walk.eyeHeightM;
    return true;
  }

  /** Nothing here is damped, so there is never a tail to cut short. */
  settle(): void {
    // Intentionally empty.
  }

  applyTo(camera: PerspectiveCamera | OrthographicCamera, aspect: number): void {
    applyPose(camera, this.pose(), aspect, clipPlanes(this.extent));
  }

  /** The point ahead that the walker is taken to be looking at. */
  private targetPoint(): Vector3 {
    const cosPitch = Math.cos(this.pitchRad);
    return new Vector3(
      -Math.sin(this.azimuthRad) * cosPitch,
      Math.sin(this.pitchRad),
      -Math.cos(this.azimuthRad) * cosPitch,
    )
      .multiplyScalar(this.focusDistanceM)
      .add(this.eye);
  }

  private anyPressed(codes: readonly string[]): boolean {
    return codes.some((code) => this.pressed.has(code));
  }

  /** +1, −1 or 0 — opposite keys held together cancel rather than fight. */
  private axis(positive: readonly string[], negative: readonly string[]): number {
    return (this.anyPressed(positive) ? 1 : 0) - (this.anyPressed(negative) ? 1 : 0);
  }
}

/* -------------------------------------------------------------------------- */
/* Making and swapping modes.                                                  */
/* -------------------------------------------------------------------------- */

/** Build a mode looking at what a viewpoint says, under a context's limits. */
export function createCameraMode(
  mode: CameraMode,
  viewpoint: Viewpoint,
  context: CameraModeContext,
): CameraModeController {
  switch (mode) {
    case 'orbit':
      return new OrbitCameraMode(viewpoint, context);
    case 'top':
      return new TopCameraMode(viewpoint, context);
    case 'walk':
      return new WalkCameraMode(viewpoint, context);
  }
}

/**
 * Change mode without changing what is being looked at.
 *
 * The new mode is built from the viewpoint the old one reports **right now** —
 * mid-damping if the old one was still moving — so the first frame after the
 * switch is the frame that would have been drawn anyway, seen from wherever the
 * new mode has to stand. The point being looked at is carried across untouched;
 * the heading is carried across too, so the building does not spin.
 *
 * Asking for the mode already in use returns the same controller, so a caller
 * can drive this straight from a state value without checking first.
 */
export function switchCameraMode(
  current: CameraModeController,
  next: CameraMode,
  context: CameraModeContext,
): CameraModeController {
  if (current.mode === next) {
    return current;
  }
  return createCameraMode(next, current.viewpoint(), context);
}
