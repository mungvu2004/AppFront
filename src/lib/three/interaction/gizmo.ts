/**
 * The handle you grab to move, turn or resize something in 3D, and the
 * arithmetic that turns a dragged cursor into a number an engineer recognises.
 *
 * A gizmo drag is not a free 3D translation. Nobody can place a point in space
 * with a 2D pointer, and a tool that pretends otherwise produces a wall that is
 * four millimetres off the floor in a direction the user never looked at. So a
 * drag here is always **one degree of freedom**: you take hold of one axis
 * handle and the pointer decides one number along it. Nine handles — three modes
 * by three axes — and each of them is a single scalar.
 *
 * That is also what makes the pointer maths honest. The cursor's ray almost
 * never meets the axis, so `closestPointOnAxis` takes the point on the axis
 * nearest the ray, which is the standard CAD answer and degrades gracefully:
 * the further the ray leans away, the less the reading moves, and when the ray
 * runs parallel to the axis there is no reading at all rather than a wild one.
 *
 * **Plan axes against scene axes.** `build/scene.ts` fixes the mapping — plan x
 * → scene x, plan y → scene **z**, elevation → scene y — and this module works
 * in the scene frame because that is the frame the camera casts into. One
 * consequence deserves saying out loud rather than being discovered: the ground
 * plane seen from a y-up scene is **left**-handed with respect to the plan, so a
 * rotation that is counter-clockwise on the drawing is clockwise about scene +y.
 * `angleAroundAxis` therefore reads the vertical axis in plan coordinates, so
 * the number it returns is the same number `Furniture.rotationDeg` stores, and
 * nobody has to remember a sign.
 *
 * **Snapping is on the result, never on the pointer.** A translation snaps its
 * offset to the 50 mm grid, so an object already on the grid stays on it and one
 * deliberately off it keeps its offset. A resize snaps the **resulting
 * dimension**, because the number the engineer is watching is the size, not the
 * distance their hand travelled. Both steps come from `SNAP_THRESHOLDS`, so the
 * 3D handle and the 2D cursor snap to the same grid by construction.
 *
 * Everything here is a pure function. No session, no store, no clock: what a
 * drag *means* is decided here, and what a drag *does* is `dragSession.ts`.
 */

import { Vector3 } from 'three';

import { snapAngle, SNAP_THRESHOLDS } from '@/domain/units/snap';
import {
  degrees,
  millimetres,
  MILLIMETRES_PER_METRE,
  roundMeasurement,
  type Degrees,
  type Millimetres,
} from '@/domain/units/types';
import { formatAngle, formatLength } from '@/lib/format/measure';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/** What a handle does to the thing it is attached to. */
export type GizmoMode = 'translate' | 'rotate' | 'scale';

/** Every mode, in the order the toolbar offers them. */
export const GIZMO_MODES: readonly GizmoMode[] = Object.freeze([
  'translate',
  'rotate',
  'scale',
] as const);

/**
 * The scene axis a drag is locked to.
 *
 * Named for the scene and not for the plan, because that is what the handle
 * points along on screen. `x` and `z` lie on the floor, `y` is height.
 */
export type GizmoAxis = 'x' | 'y' | 'z';

/** Every axis, in the order the handles are drawn. */
export const GIZMO_AXES: readonly GizmoAxis[] = Object.freeze(['x', 'y', 'z'] as const);

/**
 * The axis code shown beside the reading.
 *
 * Upper case, and invariant A6 allows exactly this: axis codes and fault codes
 * are the two things that are not written in lower-case sentence style.
 */
export const GIZMO_AXIS_LABELS: Readonly<Record<GizmoAxis, string>> = Object.freeze({
  x: 'X',
  y: 'Y',
  z: 'Z',
});

/** One of the nine handles: a mode locked to an axis. */
export interface GizmoHandle {
  readonly mode: GizmoMode;
  readonly axis: GizmoAxis;
}

/** Every handle a gizmo offers, mode by mode. */
export const GIZMO_HANDLES: readonly GizmoHandle[] = Object.freeze(
  GIZMO_MODES.flatMap((mode) => GIZMO_AXES.map((axis): GizmoHandle => ({ axis, mode }))),
);

/**
 * A ray through the scene, in scene units.
 *
 * `THREE.Ray` satisfies it, so a caller hands over `raycaster.ray` unchanged.
 * `direction` is expected to be unit length, which is what `setFromCamera`
 * produces.
 */
export interface PickRay {
  readonly origin: Vector3;
  readonly direction: Vector3;
}

/** Where the handle is, and how big the thing it is attached to is. */
export interface GizmoAnchor {
  /** The handle's position in the scene, in scene units — metres. */
  readonly position: Vector3;
  /**
   * The object's size along each axis, in millimetres.
   *
   * Only a resize needs it, and it needs it absolutely: a scale factor is a
   * ratio against a dimension, and without the dimension the reading would be a
   * distance dressed up as a size.
   */
  readonly sizeMm?: Readonly<Partial<Record<GizmoAxis, Millimetres>>>;
}

/**
 * What one drag came to, in the model's own units.
 *
 * A closed union so a consumer cannot read an angle off a translation. Every
 * member is already snapped and already sign-correct for the plan.
 */
export type GizmoDelta =
  | {
      readonly mode: 'translate';
      readonly axis: GizmoAxis;
      /** How far along the axis, snapped to the grid. Signed. */
      readonly offsetMm: Millimetres;
    }
  | {
      readonly mode: 'rotate';
      readonly axis: GizmoAxis;
      /** Turn since the drag began, snapped to the angle step. Signed, within (−180, 180]. */
      readonly angleDeg: Degrees;
    }
  | {
      readonly mode: 'scale';
      readonly axis: GizmoAxis;
      /** The dimension the object would end up with, snapped to the grid. */
      readonly lengthMm: Millimetres;
      /** That dimension over the one it started at. Always above zero. */
      readonly factor: number;
    };

/** How far a handle has got, for the outline and the floating readout. */
export type GizmoPhase = 'idle' | 'hover' | 'dragging' | 'blocked';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The grid a dragged length lands on: 50 mm.
 *
 * Read from `SNAP_THRESHOLDS` rather than written again, so the 3D handle and
 * the 2D cursor cannot come to disagree about where the grid is.
 */
export const GIZMO_GRID_STEP_MM: Millimetres = SNAP_THRESHOLDS.gridStepMm;

/** The angle a dragged rotation lands on: 15°, from the same table. */
export const GIZMO_ANGLE_STEP_DEG: Degrees = SNAP_THRESHOLDS.angleStepDeg;

/**
 * Below this, a ray and an axis are treated as parallel and there is no reading.
 *
 * Two lines that nearly line up have a nearest pair of points that races off to
 * infinity as they converge; refusing to answer is the only reading that is not
 * a lie. The value is in the units of `sin²` between two unit vectors, so a
 * thousandth is about two degrees of separation.
 */
const PARALLEL_EPSILON = 1e-3;

/** A half turn, and the fold `signedAngleDelta` brings a difference back into. */
const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;

/* -------------------------------------------------------------------------- */
/* Axes.                                                                       */
/* -------------------------------------------------------------------------- */

/** A fresh unit vector along one scene axis. */
export function axisDirection(axis: GizmoAxis): Vector3 {
  return new Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
}

/**
 * How far along the axis the ray comes closest, measured from `origin`.
 *
 * The classic nearest-points-of-two-skew-lines solution, reduced by the axis
 * direction being unit length. `null` when the ray is too near parallel to the
 * axis for the answer to mean anything.
 *
 * @returns A signed distance in scene units — metres.
 */
export function closestPointOnAxis(
  ray: PickRay,
  origin: Vector3,
  axis: GizmoAxis,
): number | null {
  const along = axisDirection(axis);
  const direction = ray.direction;
  const between = new Vector3().subVectors(origin, ray.origin);

  const alongDotDirection = along.dot(direction);
  const directionLengthSquared = direction.dot(direction);
  const denominator = directionLengthSquared - alongDotDirection * alongDotDirection;

  if (Math.abs(denominator) < PARALLEL_EPSILON) {
    return null;
  }

  const alongDotBetween = along.dot(between);
  const directionDotBetween = direction.dot(between);

  return (
    (alongDotDirection * directionDotBetween - directionLengthSquared * alongDotBetween) /
    denominator
  );
}

/**
 * Where the ray meets the plane through `origin` at right angles to the axis.
 *
 * This is the disc a rotate handle turns in. `null` when the ray runs along the
 * plane, and when the meeting point is behind the camera — a rotation driven by
 * a point the user cannot see is a rotation nobody asked for.
 */
export function intersectAxisPlane(
  ray: PickRay,
  origin: Vector3,
  axis: GizmoAxis,
): Vector3 | null {
  const normal = axisDirection(axis);
  const facing = normal.dot(ray.direction);

  if (Math.abs(facing) < PARALLEL_EPSILON) {
    return null;
  }

  const distance = normal.dot(new Vector3().subVectors(origin, ray.origin)) / facing;

  if (distance <= 0) {
    return null;
  }

  return new Vector3().copy(ray.direction).multiplyScalar(distance).add(ray.origin);
}

/**
 * The heading of a scene vector around one axis, in degrees.
 *
 * Around the **vertical** axis the answer is read in plan coordinates —
 * `atan2(plan.y, plan.x)`, which is `atan2(scene.z, scene.x)` — so it counts
 * counter-clockwise on the drawing and matches `Furniture.rotationDeg` exactly.
 * That is deliberately *not* the right-hand rule about scene +y: mapping plan y
 * onto scene z flips the handedness of the ground plane, and the choice here is
 * to agree with the drawing rather than with the scene graph, because the number
 * ends up in the model.
 *
 * The two horizontal axes are section rotations, which the plan does not store;
 * those follow the right-hand rule about their own axis.
 */
export function angleAroundAxis(offset: Vector3, axis: GizmoAxis): Degrees {
  if (axis === 'y') {
    return degrees((Math.atan2(offset.z, offset.x) * HALF_TURN_DEG) / Math.PI);
  }

  const [first, second] =
    axis === 'x' ? ([offset.y, offset.z] as const) : ([offset.x, offset.y] as const);

  return degrees((Math.atan2(second, first) * HALF_TURN_DEG) / Math.PI);
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** Scene units to model units. The scene is metres, the model is millimetres. */
function toMillimetres(sceneLength: number): Millimetres {
  return millimetres(sceneLength * MILLIMETRES_PER_METRE);
}

/** A difference of two headings, folded into (−180, 180]. */
function signedAngleDelta(from: Degrees, to: Degrees): Degrees {
  const raw = ((to - from) % FULL_TURN_DEG + FULL_TURN_DEG) % FULL_TURN_DEG;

  return degrees(raw > HALF_TURN_DEG ? raw - FULL_TURN_DEG : raw);
}

/**
 * Round a signed turn onto the angle step, keeping its sign.
 *
 * `snapAngle` does the rounding but folds its answer into `[0, 360)`, which is
 * right for a heading and wrong for a difference — it would turn a quarter turn
 * anticlockwise into three quarters clockwise. So the magnitude goes through the
 * domain function and the sign is put back here, rather than the rounding being
 * written out a second time.
 */
function snapSignedAngle(value: Degrees, stepDeg: Degrees): Degrees {
  const magnitude = snapAngle(degrees(Math.abs(value)), stepDeg);

  return degrees(value < 0 ? -magnitude : magnitude);
}

/* -------------------------------------------------------------------------- */
/* Measuring a drag.                                                           */
/* -------------------------------------------------------------------------- */

/** The steps a drag rounds onto; both default to the shared snap table. */
export interface GizmoSnapOptions {
  readonly gridStepMm?: Millimetres;
  readonly angleStepDeg?: Degrees;
}

/**
 * What the drag from `startRay` to `currentRay` comes to on this handle.
 *
 * `null` means there is no reading to be had — the pointer is looking down the
 * axis, or a resize was asked for without a dimension to resize. It never means
 * "nothing changed": a drag that returns to where it began measures zero, which
 * is a reading and a different thing from no reading at all.
 */
export function measureDrag(
  handle: GizmoHandle,
  anchor: GizmoAnchor,
  startRay: PickRay,
  currentRay: PickRay,
  options: GizmoSnapOptions = {},
): GizmoDelta | null {
  const gridStepMm = options.gridStepMm ?? GIZMO_GRID_STEP_MM;
  const angleStepDeg = options.angleStepDeg ?? GIZMO_ANGLE_STEP_DEG;
  const { axis } = handle;

  if (handle.mode === 'rotate') {
    const from = intersectAxisPlane(startRay, anchor.position, axis);
    const to = intersectAxisPlane(currentRay, anchor.position, axis);

    if (from === null || to === null) {
      return null;
    }

    const turned = signedAngleDelta(
      angleAroundAxis(new Vector3().subVectors(from, anchor.position), axis),
      angleAroundAxis(new Vector3().subVectors(to, anchor.position), axis),
    );

    return { angleDeg: snapSignedAngle(turned, angleStepDeg), axis, mode: 'rotate' };
  }

  const from = closestPointOnAxis(startRay, anchor.position, axis);
  const to = closestPointOnAxis(currentRay, anchor.position, axis);

  if (from === null || to === null) {
    return null;
  }

  const travelledMm = toMillimetres(to - from);

  if (handle.mode === 'translate') {
    // The offset is snapped, not the destination: the handle does not know where
    // the object's own origin is, and rounding a difference keeps an object that
    // was on the grid on it while leaving one deliberately off it where it was.
    return { axis, mode: 'translate', offsetMm: roundMeasurement(travelledMm, gridStepMm) };
  }

  const startSizeMm = anchor.sizeMm?.[axis];

  if (startSizeMm === undefined || !Number.isFinite(startSizeMm) || startSizeMm <= 0) {
    return null;
  }

  // The **resulting dimension** is what lands on the grid, because that is the
  // number being watched. One grid step is the floor: a size of zero is not a
  // size, and whether the size that remains is *allowed* is the command layer's
  // question, not the handle's.
  const lengthMm = millimetres(
    Math.max(gridStepMm, roundMeasurement(millimetres(startSizeMm + travelledMm), gridStepMm)),
  );

  return { axis, factor: lengthMm / startSizeMm, lengthMm, mode: 'scale' };
}

/** Did this drag come to nothing, so far? */
export function isZeroDelta(delta: GizmoDelta): boolean {
  switch (delta.mode) {
    case 'translate':
      return delta.offsetMm === 0;
    case 'rotate':
      return delta.angleDeg === 0;
    default:
      return delta.factor === 1;
  }
}

/* -------------------------------------------------------------------------- */
/* Saying it out loud.                                                         */
/* -------------------------------------------------------------------------- */

/** A leading plus, so a reading says which way it went. */
function signed(value: number, written: string): string {
  return value > 0 ? `+${written}` : written;
}

/**
 * The provisional reading shown beside the handle while the drag is live.
 *
 * Formatted here rather than in the view: invariant A15 puts the decimal comma
 * and the unit in `lib/format`, and `local/no-raw-number` stops a component
 * doing it for itself. The view receives a finished string.
 */
export function describeDelta(delta: GizmoDelta): string {
  const axis = `trục ${GIZMO_AXIS_LABELS[delta.axis]}`;

  switch (delta.mode) {
    case 'translate':
      return `${axis}: ${signed(delta.offsetMm, formatLength(delta.offsetMm, { unit: 'mm' }))}`;
    case 'rotate':
      return `${axis}: ${signed(delta.angleDeg, formatAngle(delta.angleDeg))}`;
    default:
      return `${axis}: ${formatLength(delta.lengthMm)}`;
  }
}

/**
 * The colour a handle asks for, as a status code and never as a colour.
 *
 * A blocked drag is `violation` rather than `attention`: the drop is refused
 * outright by a rule, which is what the third state colour is for, and inventing
 * a fourth is what invariant A4 exists to stop. Every other phase is `neutral` —
 * the handle carries the accent colour of invariant A2 by being a handle, not by
 * asking for a state.
 */
export function gizmoStatus(phase: GizmoPhase): ViewStatusCode {
  return phase === 'blocked' ? 'violation' : 'neutral';
}
