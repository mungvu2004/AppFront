/**
 * The wall entity.
 *
 * A wall is stored as a **centreline plus a thickness**, never as a polygon.
 * The polygon is a derived value: it depends on the neighbours a wall meets, so
 * two walls that share a corner cannot both own the corner geometry without one
 * of them going stale. `joints.ts` derives the outline; this file only declares
 * what a wall is and what makes one unusable.
 *
 * Units follow the rest of the domain: every length is millimetres, elevations
 * included. Elevations are measured from the project datum, so a wall knows the
 * vertical band it occupies and two walls on different levels never join.
 *
 * Thickness is bounded on both sides. Below 60 mm nothing can be built and the
 * value is almost always a unit mix-up (60 mm read as 6 cm read as 6 mm); above
 * 600 mm it is a wall stack or a shaft that was traced as one object. Neither is
 * repaired here: a thickness outside the range throws, because silently clamping
 * it would produce a drawing that measures differently from the one the surveyor
 * signed.
 */

import { compareNearly, isNearlyZero, type PointMm } from '../units/compare';
import { distanceBetween } from '../units/snap';
import { millimetres, type Millimetres } from '../units/types';
import type { WallId } from '../spatial/types';

export type { PointMm } from '../units/compare';

/**
 * What a wall is for.
 *
 * The four kinds are the ones that behave differently on a plan: a load-bearing
 * wall may not be moved by a fit-out, a partition may; a railing and a glazed
 * screen both bound a space without closing it, and they differ in whether the
 * boundary is transparent.
 */
export type WallKind = 'loadBearing' | 'partition' | 'railing' | 'glazed';

/** Every wall kind, in the order the interface lists them. */
export const WALL_KINDS: readonly WallKind[] = ['loadBearing', 'partition', 'railing', 'glazed'];

/** Thinnest wall the model accepts. */
export const MIN_WALL_THICKNESS_MM: Millimetres = millimetres(60);

/** Thickest wall the model accepts. */
export const MAX_WALL_THICKNESS_MM: Millimetres = millimetres(600);

/** The line through the middle of the wall section, from start to end. */
export interface WallCentreline {
  readonly start: PointMm;
  readonly end: PointMm;
}

/**
 * A wall run.
 *
 * `baseElevationMm` and `topElevationMm` are absolute heights above the project
 * datum rather than a height above the level floor, so a parapet that starts
 * half way up a storey needs no extra field to say so.
 */
export interface Wall {
  readonly id: WallId;
  readonly kind: WallKind;
  readonly centreline: WallCentreline;
  readonly thicknessMm: Millimetres;
  /** Height of the bottom of the wall, from the datum. */
  readonly baseElevationMm: Millimetres;
  /** Height of the top of the wall, from the datum. */
  readonly topElevationMm: Millimetres;
}

/** Which end of a centreline is being talked about. */
export type WallEnd = 'start' | 'end';

/** Both ends, in the order they are visited. */
export const WALL_ENDS: readonly WallEnd[] = ['start', 'end'];

/** Is this a thickness a wall may actually have? */
export function isThicknessInRange(thicknessMm: Millimetres): boolean {
  return (
    Number.isFinite(thicknessMm) &&
    compareNearly(thicknessMm, MIN_WALL_THICKNESS_MM) >= 0 &&
    compareNearly(thicknessMm, MAX_WALL_THICKNESS_MM) <= 0
  );
}

/** The point of the centreline at one end. */
export function endPoint(wall: Wall, end: WallEnd): PointMm {
  return end === 'start' ? wall.centreline.start : wall.centreline.end;
}

/** Length of the centreline. */
export function centrelineLength(wall: Wall): Millimetres {
  return distanceBetween(wall.centreline.start, wall.centreline.end);
}

/**
 * Do two walls share any height at all?
 *
 * Touching does not count: a parapet sitting exactly on top of a wall below is
 * not the same object and its ends must not be welded to the ones underneath.
 */
export function verticalRangesOverlap(first: Wall, second: Wall): boolean {
  const bottom = Math.max(first.baseElevationMm, second.baseElevationMm);
  const top = Math.min(first.topElevationMm, second.topElevationMm);
  return compareNearly(top, bottom) > 0;
}

/**
 * Reject a wall the geometry cannot work with.
 *
 * Nothing is repaired and nothing is clamped; the caller gets an exception
 * naming the wall so the value can be fixed at the source.
 *
 * @throws RangeError when the thickness is outside 60–600 mm, when the
 * centreline has no length, or when the top is not above the base.
 */
export function assertUsableWall(wall: Wall): void {
  if (!isThicknessInRange(wall.thicknessMm)) {
    throw new RangeError(
      `Wall ${wall.id} has thickness ${String(wall.thicknessMm)} mm, outside ` +
        `${String(MIN_WALL_THICKNESS_MM)}–${String(MAX_WALL_THICKNESS_MM)} mm.`,
    );
  }
  if (isNearlyZero(centrelineLength(wall))) {
    throw new RangeError(`Wall ${wall.id} has a centreline of zero length.`);
  }
  if (compareNearly(wall.topElevationMm, wall.baseElevationMm) <= 0) {
    throw new RangeError(
      `Wall ${wall.id} has top ${String(wall.topElevationMm)} mm not above base ` +
        `${String(wall.baseElevationMm)} mm.`,
    );
  }
}
