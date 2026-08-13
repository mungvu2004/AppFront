/**
 * Holding a measurement straight.
 *
 * A hand-drawn measurement is never quite square. The engineer means "across
 * this room" and the cursor lands two degrees off, which is enough to make the
 * number disagree with the sheet and start an argument about a wall that is
 * perfectly fine. Holding Shift removes that class of error outright: the second
 * point is pulled onto the nearest allowed heading, and the only allowed
 * headings are the ones a drawing is set out on — along, across, and the
 * forty-five between them.
 *
 * Two decisions are worth stating:
 *
 * - **The point is projected, not rotated.** Locking keeps the distance the
 *   cursor travelled along the heading and drops only the part that strayed off
 *   it, so the point moves as little as it can. Rotating it instead would keep
 *   the length the user never chose and move the point further than they asked.
 * - **The heading is exact.** Directions come from a table of exact components
 *   rather than from `cos` and `sin` of a snapped angle, whose sine at 180° is
 *   a hair away from zero. A measurement locked to horizontal has to be
 *   horizontal, not horizontal to within a rounding error.
 *
 * The lock works in one plane at a time — the plan for a floor measurement, an
 * elevation plane for a section — which is what makes "horizontal" and "vertical"
 * mean something in the 3D view without the module knowing anything about a
 * camera.
 */

import { isNearlyZero } from '../units/compare';
import { snapAngle } from '../units/snap';
import {
  degrees,
  millimetres,
  radians,
  radiansToDegrees,
  type Degrees,
  type Millimetres,
} from '../units/types';
import { elevationOf, measureDistance, type MeasurePoint } from './measure';

/**
 * The plane the lock works in.
 *
 * `xy` is the floor plan. `xz` and `yz` are the two elevation planes, where the
 * second axis is the vertical one, so a locked "vertical" measurement in either
 * is a pure change of level.
 */
export type MeasurePlane = 'xy' | 'xz' | 'yz';

/** Which of the allowed headings a locked measurement ended up on. */
export type LockedDirection = 'horizontal' | 'vertical' | 'diagonal';

/** The angle between two allowed headings when the diagonals are allowed. */
export const DIRECTION_LOCK_STEP_DEG: Degrees = degrees(45);

/** The angle between them when only the two axes are. */
export const ORTHOGONAL_LOCK_STEP_DEG: Degrees = degrees(90);

/** Keyboard modifiers as the interaction layer reads them off an event. */
export interface ModifierState {
  readonly shiftKey: boolean;
}

/**
 * Is the direction lock being asked for?
 *
 * Stated here rather than at each call site so the answer to "which key locks a
 * measurement" lives in one place, and so the geometry stays testable without a
 * DOM event: the caller passes the flag it already has.
 */
export function shouldLockDirection(modifiers: ModifierState): boolean {
  return modifiers.shiftKey;
}

export interface DirectionLockOptions {
  /** Whether the lock applies; pass the Shift state straight through. */
  readonly enabled?: boolean;
  /** Plane the measurement is being drawn in. Defaults to the floor plan. */
  readonly plane?: MeasurePlane;
  /** Allow the 45° headings as well as the two axes. Defaults to on. */
  readonly allowDiagonal?: boolean;
}

export interface DirectionLockResult {
  /** Where the point ends up: on the heading when locked, untouched when not. */
  readonly point: MeasurePoint;
  /** Which heading it was pulled onto; `null` when nothing was locked. */
  readonly direction: LockedDirection | null;
  /** That heading in degrees within `[0, 360)`; `null` when nothing was locked. */
  readonly headingDeg: Degrees | null;
  /** How far the point moved, so the interface can say the lock did something. */
  readonly correctionMm: Millimetres;
  readonly locked: boolean;
}

type AxisName = 'x' | 'y' | 'z';

/** The two axes of each plane: the first reads across, the second up. */
const PLANE_AXES: Readonly<Record<MeasurePlane, readonly [AxisName, AxisName]>> = {
  xy: ['x', 'y'],
  xz: ['x', 'z'],
  yz: ['y', 'z'],
};

/**
 * Exact components of every allowed heading.
 *
 * Written out rather than computed, so that horizontal is exactly horizontal and
 * the diagonals are exactly symmetric.
 */
const HALF_DIAGONAL = Math.SQRT1_2;

const UNIT_BY_HEADING: ReadonlyMap<number, readonly [number, number]> = new Map([
  [0, [1, 0] as const],
  [45, [HALF_DIAGONAL, HALF_DIAGONAL] as const],
  [90, [0, 1] as const],
  [135, [-HALF_DIAGONAL, HALF_DIAGONAL] as const],
  [180, [-1, 0] as const],
  [225, [-HALF_DIAGONAL, -HALF_DIAGONAL] as const],
  [270, [0, -1] as const],
  [315, [HALF_DIAGONAL, -HALF_DIAGONAL] as const],
]);

/** Decimals kept so a locked coordinate lands on the heading exactly. */
const RESULT_PRECISION = 1e6;

function roundResult(value: number): number {
  return Math.round(value * RESULT_PRECISION) / RESULT_PRECISION;
}

function readAxis(point: MeasurePoint, axis: AxisName): number {
  switch (axis) {
    case 'x':
      return point.x;
    case 'y':
      return point.y;
    default:
      return elevationOf(point);
  }
}

function directionOf(headingDeg: number): LockedDirection {
  if (headingDeg === 0 || headingDeg === 180) {
    return 'horizontal';
  }
  if (headingDeg === 90 || headingDeg === 270) {
    return 'vertical';
  }
  return 'diagonal';
}

/**
 * Rebuild a point from the two in-plane coordinates.
 *
 * The axis outside the plane is taken from the anchor, which is what keeps a
 * locked measurement inside the plane it was drawn in. The elevation is only
 * written back when one of the two points carried one, so a plan measurement
 * stays a plan measurement instead of quietly acquiring a `z` of zero.
 */
function writePlanePoint(
  anchor: MeasurePoint,
  point: MeasurePoint,
  plane: MeasurePlane,
  across: number,
  up: number,
): MeasurePoint {
  const [firstAxis, secondAxis] = PLANE_AXES[plane];
  const coordinates: Record<AxisName, number> = {
    x: anchor.x,
    y: anchor.y,
    z: elevationOf(anchor),
  };
  coordinates[firstAxis] = across;
  coordinates[secondAxis] = up;

  const carriesElevation = anchor.z !== undefined || point.z !== undefined;

  return carriesElevation
    ? { x: millimetres(coordinates.x), y: millimetres(coordinates.y), z: millimetres(coordinates.z) }
    : { x: millimetres(coordinates.x), y: millimetres(coordinates.y) };
}

/**
 * Pull a point onto the nearest allowed heading from an anchor.
 *
 * The anchor is the point already placed — the first pick of a distance, the
 * previous vertex of a chain. With the lock off the point comes back untouched,
 * so the caller passes the Shift state in and never branches around the call.
 *
 * A point sitting on the anchor has no heading to lock to; it comes back flattened
 * into the plane, unlocked, and the interface simply shows no hint until the
 * cursor moves.
 */
export function lockDirection(
  anchor: MeasurePoint,
  point: MeasurePoint,
  options: DirectionLockOptions = {},
): DirectionLockResult {
  const enabled = options.enabled ?? true;
  const plane = options.plane ?? 'xy';
  const allowDiagonal = options.allowDiagonal ?? true;

  if (!enabled) {
    return {
      point,
      direction: null,
      headingDeg: null,
      correctionMm: millimetres(0),
      locked: false,
    };
  }

  const [firstAxis, secondAxis] = PLANE_AXES[plane];
  const anchorAcross = readAxis(anchor, firstAxis);
  const anchorUp = readAxis(anchor, secondAxis);
  const across = readAxis(point, firstAxis) - anchorAcross;
  const up = readAxis(point, secondAxis) - anchorUp;

  if (isNearlyZero(across) && isNearlyZero(up)) {
    const flattened = writePlanePoint(anchor, point, plane, anchorAcross, anchorUp);
    return {
      point: flattened,
      direction: null,
      headingDeg: null,
      correctionMm: measureDistance(point, flattened).lengthMm,
      locked: false,
    };
  }

  const rawHeading = radiansToDegrees(radians(Math.atan2(up, across)));
  const step = allowDiagonal ? DIRECTION_LOCK_STEP_DEG : ORTHOGONAL_LOCK_STEP_DEG;
  const headingDeg = snapAngle(rawHeading, step);
  const unit = UNIT_BY_HEADING.get(headingDeg);

  if (unit === undefined) {
    // Unreachable: `snapAngle` folds into `[0, 360)` on a step that divides it.
    return {
      point,
      direction: null,
      headingDeg: null,
      correctionMm: millimetres(0),
      locked: false,
    };
  }

  const [unitAcross, unitUp] = unit;
  const along = across * unitAcross + up * unitUp;
  const locked = writePlanePoint(
    anchor,
    point,
    plane,
    roundResult(anchorAcross + along * unitAcross),
    roundResult(anchorUp + along * unitUp),
  );

  return {
    point: locked,
    direction: directionOf(headingDeg),
    headingDeg,
    correctionMm: measureDistance(point, locked).lengthMm,
    locked: true,
  };
}
