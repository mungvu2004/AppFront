/**
 * Snapping a hand-placed point onto the things an engineer meant to hit.
 *
 * Nobody clicks a wall corner exactly, so the cursor has to be pulled onto the
 * nearest meaningful anchor. Two properties make that pleasant rather than
 * infuriating:
 *
 * - **One answer, never a list.** A snap that offers three candidates has moved
 *   the decision back onto the user at the worst possible moment. `snapToTargets`
 *   returns exactly one target, or none, together with its kind so the interface
 *   can say what it caught.
 * - **Priority beats distance.** A wall corner 100 mm away wins over a grid line
 *   20 mm away, because the corner is what the drawing is about and the grid is
 *   only scaffolding. Distance decides only inside one kind.
 *
 * The order is: wall vertex, intersection, midpoint, perpendicular foot, grid.
 *
 * Every function is pure and deterministic: the same arguments always give the
 * same answer, ties included, and snapping an already-snapped point returns it
 * unchanged.
 */

import { compareNearly, isNearlyZero, type PointMm } from './compare';
import { degrees, millimetres, normaliseDegrees, roundMeasurement, type Degrees, type Millimetres } from './types';

export type { PointMm } from './compare';

/** Anchors that are a single point on the plan. */
export type AnchorKind = 'wallVertex' | 'intersection' | 'midpoint';

/** Everything the cursor can be caught by, grid included. */
export type SnapTargetKind = AnchorKind | 'perpendicular' | 'grid';

/** A wall run the cursor can drop a perpendicular onto. */
export interface SnapSegment {
  readonly start: PointMm;
  readonly end: PointMm;
}

/** One thing the cursor may snap to. */
export type SnapTarget =
  | { readonly kind: AnchorKind; readonly id: string; readonly position: PointMm }
  | { readonly kind: 'perpendicular'; readonly id: string; readonly segment: SnapSegment };

/** The single target the cursor was caught by, or none. */
export interface SnapResult {
  /** Where the point ends up: the anchor when caught, the input when not. */
  readonly point: PointMm;
  /** Kind of anchor caught, for the hint shown next to the cursor. */
  readonly kind: SnapTargetKind | null;
  /** Id of the caught target; the grid has none. */
  readonly targetId: string | null;
  /** How far the point moved. */
  readonly distanceMm: Millimetres;
  readonly snapped: boolean;
}

/** Every threshold snapping depends on, in one place. */
export const SNAP_THRESHOLDS = {
  /** Grid pitch, in millimetres. */
  gridStepMm: millimetres(50),
  /** Angle pitch, in degrees. */
  angleStepDeg: degrees(15),
  /** How far the cursor reaches for an anchor. */
  captureRadiusMm: millimetres(120),
} as const;

/**
 * Which kind wins when both are in reach. Earlier is stronger.
 *
 * Exported so the interface can list the kinds in the same order it resolves
 * them, instead of restating the order and drifting out of step.
 */
export const SNAP_PRIORITY: readonly SnapTargetKind[] = [
  'wallVertex',
  'intersection',
  'midpoint',
  'perpendicular',
  'grid',
];

/** Decimals kept so a snapped coordinate lands on the grid exactly. */
const RESULT_PRECISION = 1e6;

export interface SnapToTargetsOptions {
  /** How far the cursor reaches; anything further is ignored. */
  readonly captureRadiusMm?: Millimetres;
  /** Snap to the grid when nothing better is in reach. Defaults to on. */
  readonly gridEnabled?: boolean;
  readonly gridStepMm?: Millimetres;
  /** Kinds to ignore entirely, so each can be switched off on its own. */
  readonly disabledKinds?: readonly SnapTargetKind[];
}

/**
 * Round a point onto the grid.
 *
 * Returns the point untouched when snapping is switched off, so a caller can
 * pass the toggle straight through instead of branching around the call.
 */
export function snapToGrid(
  point: PointMm,
  stepMm: Millimetres = SNAP_THRESHOLDS.gridStepMm,
  enabled = true,
): PointMm {
  if (!enabled) {
    return point;
  }
  return {
    x: roundMeasurement(point.x, stepMm),
    y: roundMeasurement(point.y, stepMm),
  };
}

/**
 * Round an angle onto the nearest step and fold it into `[0, 360)`.
 *
 * The rounding repeats `roundMeasurement` rather than calling it, because that
 * function takes millimetres; letting an angle through it is exactly the mix-up
 * the labelled types exist to prevent.
 *
 * @throws RangeError when the step is not a positive finite angle.
 */
export function snapAngle(
  angle: Degrees,
  stepDeg: Degrees = SNAP_THRESHOLDS.angleStepDeg,
  enabled = true,
): Degrees {
  if (!enabled) {
    return angle;
  }
  if (!Number.isFinite(stepDeg) || stepDeg <= 0) {
    throw new RangeError(`Angle step must be a positive angle: ${String(stepDeg)}`);
  }
  const ratio = angle / stepDeg;
  const rounded = ratio < 0 ? -Math.round(-ratio) : Math.round(ratio);
  const snapped = Math.round(rounded * stepDeg * RESULT_PRECISION) / RESULT_PRECISION;
  const normalised = normaliseDegrees(degrees(snapped));
  // Rounding a small negative angle produces `-0`, which is the same heading as
  // `0` but a different value to `Object.is`. Callers get the positive form.
  return isNearlyZero(normalised) ? degrees(0) : normalised;
}

/** Straight-line distance between two plan coordinates. */
export function distanceBetween(first: PointMm, second: PointMm): Millimetres {
  return millimetres(Math.hypot(first.x - second.x, first.y - second.y));
}

/**
 * Foot of the perpendicular from a point onto a wall run.
 *
 * `null` when the wall run has no length, or when the foot falls beyond either
 * end: a perpendicular that misses the wall is not a perpendicular of that
 * wall, and its endpoints are already offered as vertices.
 */
export function perpendicularFoot(point: PointMm, segment: SnapSegment): PointMm | null {
  const runX = segment.end.x - segment.start.x;
  const runY = segment.end.y - segment.start.y;
  const lengthSquared = runX * runX + runY * runY;
  if (isNearlyZero(lengthSquared)) {
    return null;
  }
  const along =
    ((point.x - segment.start.x) * runX + (point.y - segment.start.y) * runY) / lengthSquared;
  if (along < 0 || along > 1) {
    return null;
  }
  return {
    x: millimetres(segment.start.x + along * runX),
    y: millimetres(segment.start.y + along * runY),
  };
}

/** A target resolved to a concrete position, ready to be ranked. */
interface Candidate {
  readonly kind: SnapTargetKind;
  readonly targetId: string | null;
  readonly position: PointMm;
  readonly distanceMm: Millimetres;
  readonly priority: number;
  /** Position in the input list, the last tie-break. */
  readonly order: number;
}

function priorityOf(kind: SnapTargetKind): number {
  const index = SNAP_PRIORITY.indexOf(kind);
  return index < 0 ? SNAP_PRIORITY.length : index;
}

/**
 * Is the first candidate the one to keep?
 *
 * Kind first, then distance compared with a tolerance, then the target id, then
 * the input order. The last two steps never depend on floating point noise, so
 * two equally good anchors always resolve the same way.
 */
function isBetter(candidate: Candidate, incumbent: Candidate): boolean {
  if (candidate.priority !== incumbent.priority) {
    return candidate.priority < incumbent.priority;
  }
  const byDistance = compareNearly(candidate.distanceMm, incumbent.distanceMm);
  if (byDistance !== 0) {
    return byDistance < 0;
  }
  const candidateId = candidate.targetId ?? '';
  const incumbentId = incumbent.targetId ?? '';
  if (candidateId !== incumbentId) {
    return candidateId < incumbentId;
  }
  return candidate.order < incumbent.order;
}

function resolvePosition(point: PointMm, target: SnapTarget): PointMm | null {
  return target.kind === 'perpendicular' ? perpendicularFoot(point, target.segment) : target.position;
}

/**
 * Catch a hand-placed point on the nearest meaningful anchor.
 *
 * Targets further than the capture radius are ignored, including grid nodes, so
 * a coarse grid cannot drag the cursor across the drawing. Among what remains,
 * the strongest kind wins outright and distance only separates equals.
 */
export function snapToTargets(
  point: PointMm,
  targets: readonly SnapTarget[],
  options: SnapToTargetsOptions = {},
): SnapResult {
  const radius = options.captureRadiusMm ?? SNAP_THRESHOLDS.captureRadiusMm;
  const gridStep = options.gridStepMm ?? SNAP_THRESHOLDS.gridStepMm;
  const gridEnabled = options.gridEnabled ?? true;
  const disabled = options.disabledKinds ?? [];
  const isEnabled = (kind: SnapTargetKind): boolean => !disabled.includes(kind);

  const candidates: Candidate[] = [];

  targets.forEach((target, order) => {
    if (!isEnabled(target.kind)) {
      return;
    }
    const position = resolvePosition(point, target);
    if (position === null) {
      return;
    }
    const distanceMm = distanceBetween(point, position);
    if (compareNearly(distanceMm, radius) > 0) {
      return;
    }
    candidates.push({
      kind: target.kind,
      targetId: target.id,
      position,
      distanceMm,
      priority: priorityOf(target.kind),
      order,
    });
  });

  if (gridEnabled && isEnabled('grid')) {
    const position = snapToGrid(point, gridStep);
    const distanceMm = distanceBetween(point, position);
    if (compareNearly(distanceMm, radius) <= 0) {
      candidates.push({
        kind: 'grid',
        targetId: null,
        position,
        distanceMm,
        priority: priorityOf('grid'),
        order: targets.length,
      });
    }
  }

  const best = candidates.reduce<Candidate | null>(
    (winner, candidate) => (winner === null || isBetter(candidate, winner) ? candidate : winner),
    null,
  );

  if (best === null) {
    return {
      point,
      kind: null,
      targetId: null,
      distanceMm: millimetres(0),
      snapped: false,
    };
  }

  return {
    point: best.position,
    kind: best.kind,
    targetId: best.targetId,
    distanceMm: best.distanceMm,
    snapped: true,
  };
}
