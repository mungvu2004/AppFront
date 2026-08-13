/**
 * Putting an opening back on the wall it belongs to, and back on the plan again.
 *
 * A model reading a scanned drawing gets doors and windows nearly right: a door
 * traced 40 mm off the centreline, a window drawn on the outer face rather than
 * through the middle, a leaf whose rectangle leans a little. None of that is a
 * different door. All of it means the opening arrives with an absolute point and
 * no idea which wall owns it.
 *
 * Two functions, exact opposites of each other, carry the whole idea:
 *
 * - `attachToWall` takes the traced centre, finds the wall it was meant for,
 *   drops a perpendicular onto that wall's centreline and keeps **only** the
 *   fraction along it. The absolute point is deliberately discarded.
 * - `placeOnWall` turns that fraction back into a coordinate whenever something
 *   needs to be drawn.
 *
 * Because the stored form is a fraction, dragging a wall moves its openings for
 * free: the same fraction resolves against the new centreline. Nothing has to be
 * recomputed, so nothing can be forgotten and left behind.
 *
 * How near counts as near is measured from the wall **body**, not its centreline:
 * the radius is how far outside the face a traced point may sit. A model that
 * traces a window on the outer face of a 400 mm wall is 200 mm from the
 * centreline while being exactly on the wall, and a radius measured to the
 * centreline would orphan it. The same measure settles which of two walls is
 * nearest, so a point inside a thick wall is not stolen by a thin partition
 * whose centreline happens to be closer.
 *
 * Nothing here deletes anything. An opening no wall will take comes back marked
 * orphan, keeping its traced centre, together with a Vietnamese sentence saying
 * why. Every function is pure: the arguments are never written to, and the same
 * arguments always give the same answer, ties included.
 *
 * Only plan geometry decides. Whether an opening fits between the base and the
 * top of its wall is a separate question, asked elsewhere; `sillHeightMm` and
 * `heightMm` travel through untouched.
 */

import { compareNearly, isNearlyZero, type PointMm } from '../units/compare';
import { distanceBetween } from '../units/snap';
import { millimetres, type Millimetres } from '../units/types';
import type { WallId } from '../spatial/types';
import { centrelineLength, type Wall } from '../walls/types';
import {
  clampRelativePosition,
  describeOpeningKind,
  isValidRelativePosition,
  type AttachedOpening,
  type Opening,
  type OrphanOpening,
  type OrphanReason,
  type RelativePosition,
  type TracedOpening,
} from './types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * How far outside a wall face a traced centre may sit and still belong to it.
 *
 * 150 mm is about the width of a wall: a point further out than that is not a
 * sloppy trace of this wall, it is a trace of something else.
 */
export const DEFAULT_ATTACH_RADIUS_MM: Millimetres = millimetres(150);

/** What attaching did, and what it wants the reviewer to know. */
export interface OpeningAttachment {
  /** The opening as it should now be stored: attached, or marked orphan. */
  readonly opening: Opening;
  /** The wall it went onto; `null` when it stayed an orphan. */
  readonly wallId: WallId | null;
  /**
   * How far the traced centre sat from that wall's centreline.
   *
   * Kept even when the opening was orphaned for being out of range, so the
   * message can say by how much. `null` only when there was no candidate at all.
   */
  readonly distanceToCentrelineMm: Millimetres | null;
  /** The same gap measured from the wall face; `0` anywhere inside the body. */
  readonly distanceToFaceMm: Millimetres | null;
  /** Vietnamese sentence for the review log. */
  readonly message: string;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                 */
/* -------------------------------------------------------------------------- */

/** A wall the opening could belong to, resolved and ready to be ranked. */
interface Candidate {
  readonly wall: Wall;
  readonly relativePosition: RelativePosition;
  readonly distanceToCentrelineMm: Millimetres;
  readonly distanceToFaceMm: Millimetres;
  /** Position in the input list, the last tie-break. */
  readonly order: number;
}

function isFinitePoint(point: PointMm): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** A length with the Vietnamese decimal comma; whole values keep no decimal. */
function formatLength(valueMm: Millimetres): string {
  const rounded = Math.round(valueMm * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} mm`;
}

/** A fraction of a wall, read the way the rest of the interface reads numbers. */
function formatRelative(value: RelativePosition): string {
  return String(Math.round(value * 1000) / 1000).replace('.', ',');
}

/** "cửa đi D-3", for the middle of a sentence. */
function nameOf(opening: TracedOpening): string {
  return `${describeOpeningKind(opening.kind).toLowerCase()} ${opening.id}`;
}

/**
 * Where along a wall a point projects to, as a fraction of the centreline.
 *
 * `null` when the wall has no direction to project onto, or when the point is
 * not a coordinate. A foot that lands past either end is pulled back onto the
 * end rather than rejected: a door traced just beyond a corner belongs to that
 * wall at its very end, and `snap.perpendicularFoot` cannot say so because it
 * deliberately drops feet outside the segment.
 */
function projectOntoWall(centre: PointMm, wall: Wall): RelativePosition | null {
  const runX = wall.centreline.end.x - wall.centreline.start.x;
  const runY = wall.centreline.end.y - wall.centreline.start.y;
  const lengthSquared = runX * runX + runY * runY;

  if (isNearlyZero(lengthSquared)) {
    return null;
  }

  const along =
    ((centre.x - wall.centreline.start.x) * runX + (centre.y - wall.centreline.start.y) * runY) /
    lengthSquared;

  if (!Number.isFinite(along)) {
    return null;
  }

  return clampRelativePosition(along);
}

/** How far a gap measured to the centreline reaches past the wall face. */
function gapOutsideFace(distanceToCentrelineMm: Millimetres, wall: Wall): Millimetres {
  return millimetres(Math.max(0, distanceToCentrelineMm - wall.thicknessMm / 2));
}

function candidatesFor(centre: PointMm, walls: readonly Wall[]): readonly Candidate[] {
  const candidates: Candidate[] = [];

  walls.forEach((wall, order) => {
    const relativePosition = projectOntoWall(centre, wall);

    if (relativePosition === null) {
      return;
    }

    const distanceToCentrelineMm = distanceBetween(centre, placeOnWall(wall, relativePosition));

    candidates.push({
      wall,
      relativePosition,
      distanceToCentrelineMm,
      distanceToFaceMm: gapOutsideFace(distanceToCentrelineMm, wall),
      order,
    });
  });

  return candidates;
}

/**
 * Is the first candidate the one to keep?
 *
 * Distance from the body first, then distance from the centreline, then the wall
 * id, then the input order. The last two never depend on floating point noise, so
 * two walls that are equally close always resolve the same way — a door on a
 * corner must not change owner between two runs of the same import.
 */
function isBetter(candidate: Candidate, incumbent: Candidate): boolean {
  const byFace = compareNearly(candidate.distanceToFaceMm, incumbent.distanceToFaceMm);
  if (byFace !== 0) {
    return byFace < 0;
  }
  const byCentreline = compareNearly(
    candidate.distanceToCentrelineMm,
    incumbent.distanceToCentrelineMm,
  );
  if (byCentreline !== 0) {
    return byCentreline < 0;
  }
  if (candidate.wall.id !== incumbent.wall.id) {
    return candidate.wall.id < incumbent.wall.id;
  }
  return candidate.order < incumbent.order;
}

/**
 * Copy the opening across, dropping wherever it used to be.
 *
 * The properties are listed rather than spread because the input may itself be an
 * orphan being retried, and spreading would carry its old reason along.
 */
function orphanFrom(opening: TracedOpening, reason: OrphanReason): OrphanOpening {
  return {
    id: opening.id,
    kind: opening.kind,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    sillHeightMm: opening.sillHeightMm,
    swing: opening.swing,
    centre: opening.centre,
    wallId: null,
    orphanReason: reason,
  };
}

function attachedFrom(opening: TracedOpening, candidate: Candidate): AttachedOpening {
  return {
    id: opening.id,
    kind: opening.kind,
    widthMm: opening.widthMm,
    heightMm: opening.heightMm,
    sillHeightMm: opening.sillHeightMm,
    swing: opening.swing,
    wallId: candidate.wall.id,
    relativePosition: candidate.relativePosition,
  };
}

/** The sentence every orphan ends with, so all three read the same way. */
const ORPHAN_TAIL = 'nên đã đánh dấu mồ côi và giữ nguyên toạ độ đã vẽ.';

function orphanMessage(
  opening: TracedOpening,
  reason: OrphanReason,
  nearest: Candidate | null,
  radiusMm: Millimetres,
): string {
  if (nearest !== null) {
    return (
      `${describeOpeningKind(opening.kind)} ${opening.id} cách mặt tường gần nhất ` +
      `${nearest.wall.id} tới ${formatLength(nearest.distanceToFaceMm)}, vượt bán kính ` +
      `${formatLength(radiusMm)} ${ORPHAN_TAIL}`
    );
  }
  if (reason === 'centreUnknown') {
    return `Không có toạ độ hợp lệ cho ${nameOf(opening)} ${ORPHAN_TAIL}`;
  }
  return `Chưa có tường nào để gắn ${nameOf(opening)} ${ORPHAN_TAIL}`;
}

function orphanAttachment(
  opening: TracedOpening,
  reason: OrphanReason,
  nearest: Candidate | null,
  radiusMm: Millimetres,
): OpeningAttachment {
  const message = orphanMessage(opening, reason, nearest, radiusMm);

  return {
    opening: orphanFrom(opening, reason),
    wallId: null,
    distanceToCentrelineMm: nearest === null ? null : nearest.distanceToCentrelineMm,
    distanceToFaceMm: nearest === null ? null : nearest.distanceToFaceMm,
    message,
  };
}

function attachedAttachment(opening: TracedOpening, candidate: Candidate): OpeningAttachment {
  const fromStartMm = millimetres(candidate.relativePosition * centrelineLength(candidate.wall));

  return {
    opening: attachedFrom(opening, candidate),
    wallId: candidate.wall.id,
    distanceToCentrelineMm: candidate.distanceToCentrelineMm,
    distanceToFaceMm: candidate.distanceToFaceMm,
    message:
      `Đã gắn ${nameOf(opening)} vào tường ${candidate.wall.id}, cách đầu tường ` +
      `${formatLength(fromStartMm)} (vị trí tương đối ` +
      `${formatRelative(candidate.relativePosition)}), lệch ` +
      `${formatLength(candidate.distanceToCentrelineMm)} khỏi tim tường.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Turn a fraction of a wall back into a coordinate on the plan.
 *
 * The exact inverse of the projection `attachToWall` performs: for a centre that
 * sat on the centreline, the point that comes back is the point that went in.
 * For one that sat off to the side, it is the foot of the perpendicular — the
 * sideways offset is what attaching threw away on purpose, because a door is in
 * the wall, not beside it.
 *
 * @throws RangeError when the position is not a fraction within `[0, 1]`. A value
 * outside the range is invented data, not a rounding error, and clamping it would
 * silently move an opening.
 */
export function placeOnWall(wall: Wall, relativePosition: RelativePosition): PointMm {
  if (!isValidRelativePosition(relativePosition)) {
    throw new RangeError(
      `Opening position on wall ${wall.id} must be a fraction within 0–1: ` +
        `${String(relativePosition)}`,
    );
  }

  const along = clampRelativePosition(relativePosition);

  return {
    x: millimetres(
      wall.centreline.start.x + (wall.centreline.end.x - wall.centreline.start.x) * along,
    ),
    y: millimetres(
      wall.centreline.start.y + (wall.centreline.end.y - wall.centreline.start.y) * along,
    ),
  };
}

/**
 * Attach a traced opening to the wall it was meant for.
 *
 * The nearest wall wins, measured from its body so that thickness counts, and the
 * traced centre is projected perpendicularly onto its centreline and stored as a
 * fraction. A foot that falls past a wall end is pulled onto the end.
 *
 * When nothing is in reach the opening comes back as an orphan, with its traced
 * centre intact and a reason attached. Passing that orphan back in later — once
 * the missing wall has been drawn — is all a retry takes.
 *
 * Walls with no length are skipped rather than rejected: a wall of a few
 * micrometres has no direction to project onto, and it is `cleanupWalls` that
 * decides what to do about it.
 *
 * @throws RangeError when the radius is not a finite, non-negative length.
 */
export function attachToWall(
  opening: TracedOpening,
  walls: readonly Wall[],
  radiusMm: Millimetres = DEFAULT_ATTACH_RADIUS_MM,
): OpeningAttachment {
  if (!Number.isFinite(radiusMm) || radiusMm < 0) {
    throw new RangeError(`Attach radius must be a non-negative length: ${String(radiusMm)}`);
  }

  if (!isFinitePoint(opening.centre)) {
    return orphanAttachment(opening, 'centreUnknown', null, radiusMm);
  }

  const best = candidatesFor(opening.centre, walls).reduce<Candidate | null>(
    (winner, candidate) => (winner === null || isBetter(candidate, winner) ? candidate : winner),
    null,
  );

  if (best === null) {
    return orphanAttachment(opening, 'noUsableWall', null, radiusMm);
  }

  if (compareNearly(best.distanceToFaceMm, radiusMm) > 0) {
    return orphanAttachment(opening, 'noWallInRange', best, radiusMm);
  }

  return attachedAttachment(opening, best);
}

/**
 * Where an attached opening sits on the plan right now.
 *
 * The wall must be the host: drawing an opening against a wall that does not own
 * it would put it somewhere nobody asked for, so the mismatch throws instead.
 *
 * @throws Error when the wall is not the one the opening belongs to.
 */
export function openingCentre(wall: Wall, opening: AttachedOpening): PointMm {
  if (wall.id !== opening.wallId) {
    throw new Error(
      `Opening ${opening.id} belongs to wall ${opening.wallId}, not ${wall.id}; ` +
        'it cannot be placed on this wall.',
    );
  }

  return placeOnWall(wall, opening.relativePosition);
}
