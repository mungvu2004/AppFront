/**
 * What is left over once the scan has been placed on the model.
 *
 * A transform (`transform.ts`) says where the drawing sits. It does not say
 * whether the drawing and the model agree, and that is the question the
 * comparison screen asks. This module answers it in the only unit an engineer
 * can act on: for each setting-out axis the drawing shows, how far the model's
 * matching axis actually is from it, in millimetres.
 *
 * ## Why axes, and not walls
 *
 * A wall traced off a scan and a wall in the model are different objects with
 * different ends, so "the same wall" is a matching problem with no stable
 * answer. An axis is not: `detectAxes` recovers it from two or more aligned
 * walls, which is precisely the setting-out intent both sides were built from.
 * `A` on the scan and `A` in the model are the same line by construction, and
 * the gap between them is the misalignment — the number the drawing office would
 * write on a snag list.
 *
 * ## Two coordinate frames, one gate between them
 *
 * `detectAxes` is the only axis detector this domain has, and it labels every
 * length `Millimetres` because it normally runs over the model's own walls. Run
 * over geometry traced off a scan, it returns the same shape holding the
 * **image's** numbers. Rather than let that assumption spread, this module
 * converts at exactly one place — `midpointOf` builds the axis's midpoint in the
 * image's pixel grid, through `pixels()`, the units module's own boundary
 * constructor, and hands it to `imagePixelToModelMm`. After that line, every
 * coordinate in this file is model millimetres.
 *
 * ## No new arithmetic
 *
 * The distance itself is `measureDistance` (M-15). The axis's own definition
 * supplies the point to measure to: `coordinateMm` is documented as "x when
 * vertical, y when horizontal", so the nearest point on a model axis to a point
 * `p` is `p` with that one coordinate replaced. Reading a field is not geometry,
 * and this file writes none.
 */

import type { DetectedAxis } from '../axes/detect';
import { labelAxes } from '../axes/label';
import type { AxisLabelOverride, LabelledAxis } from '../axes/label';
import { measureDistance } from '../measure/measure';
import type { AxisDirection, OpeningId, RoomId, WallId } from '../spatial/types';
import { compareNearly, type PointMm } from '../units/compare';
import { pixels } from '../units/scale';
import type { Millimetres } from '../units/types';
import { imagePixelToModelMm, type OverlayTransform } from './transform';

/** Anything a deviation can be pinned to. */
export type DeviationSubjectId = WallId | OpeningId | RoomId;

/**
 * One place where the model and the drawing disagree.
 *
 * `fromMm` and `toMm` are the two ends of the segment whose length is
 * `deviationMm`, kept so the screen can draw the very measurement it quotes
 * rather than a decorative line near it.
 */
export interface DeviationRegion {
  /** Deterministic, and stable across runs of the same input. */
  readonly id: string;
  /**
   * Where to look: the axis's code — `'A'`, `'3'`, `'AB'`.
   *
   * A bare code, not a sentence: this layer produces no reader-facing text, and
   * the code keeps its capitals under A6's exception for axis marks.
   */
  readonly reference: string;
  /** Where the drawing puts the axis, in model space. */
  readonly fromMm: PointMm;
  /** Where the model puts it. */
  readonly toMm: PointMm;
  /** How far apart the two are. A length, so never negative. */
  readonly deviationMm: Millimetres;
  /** The model objects this deviation moves. Never empty. */
  readonly subjectIds: readonly DeviationSubjectId[];
}

/** Everything needed to compare one placed drawing against one model. */
export interface DrawingToModelInput {
  /**
   * Axes recovered from the scan, in the image's own pixel grid.
   *
   * Produced by running `detectAxes` over geometry traced off the scan; see the
   * note on coordinate frames at the top of this file.
   */
  readonly drawingAxes: readonly DetectedAxis[];
  /** Axes recovered from the model's walls, already in model millimetres. */
  readonly modelAxes: readonly DetectedAxis[];
  /** Where the scan sits in the model's space. */
  readonly transform: OverlayTransform;
  /**
   * Names a person put on the model's axes.
   *
   * Passed straight to `labelAxes`, so a user-named axis is quoted by the name
   * they gave it and not by the one the generator would have picked.
   */
  readonly labelOverrides?: readonly AxisLabelOverride[];
}

/**
 * The middle of a scan-side axis, placed in the model.
 *
 * A vertical axis is fixed at `coordinateMm` across and runs from `startMm` to
 * `endMm` along; a horizontal one is the same statement with the roles of the
 * two swapped. The midpoint is taken in the image grid rather than between two
 * converted ends: a similarity transform carries midpoints to midpoints, so both
 * routes give the same point, and this one converts once instead of twice.
 */
function midpointOf(axis: DetectedAxis, transform: OverlayTransform): PointMm {
  const along = (axis.startMm + axis.endMm) / 2;
  const point =
    axis.direction === 'vertical'
      ? { x: pixels(axis.coordinateMm), y: pixels(along) }
      : { x: pixels(along), y: pixels(axis.coordinateMm) };

  return imagePixelToModelMm(transform, point);
}

/**
 * The point on a model axis nearest to `point`.
 *
 * The axis is a line at a fixed coordinate, so this is `point` with that one
 * coordinate replaced — read off the axis's own definition, not computed.
 */
function nearestPointOn(axis: DetectedAxis, point: PointMm): PointMm {
  return axis.direction === 'vertical'
    ? { x: axis.coordinateMm, y: point.y }
    : { x: point.x, y: axis.coordinateMm };
}

/** How far a point sits from a model axis's line, across the axis. */
function offsetFrom(axis: DetectedAxis, point: PointMm): number {
  const coordinate = axis.direction === 'vertical' ? point.x : point.y;
  return Math.abs(coordinate - axis.coordinateMm);
}

/**
 * The model axis a placed drawing axis is talking about.
 *
 * The nearest unclaimed one running the same way, and claiming it takes it out
 * of the pool: two lines of the drawing can never both be "the same axis" as one
 * line of the model, which would double-count a single misalignment and inflate
 * every figure the panel shows. A drawing axis left without a partner produces
 * no region at all — an axis the model does not have is a missing axis, which is
 * a different finding and not this file's to report.
 *
 * There is deliberately no maximum distance. A wall set out 300 mm from where
 * the drawing puts it is exactly what this screen exists to surface, and a
 * radius would quietly drop the worst cases first.
 */
function claimPartner(
  midpoint: PointMm,
  direction: AxisDirection,
  candidates: readonly LabelledAxis[],
  claimed: Set<number>,
): LabelledAxis | null {
  let bestIndex = -1;
  let bestOffset = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    if (claimed.has(index) || candidate.axis.direction !== direction) {
      return;
    }
    const offset = offsetFrom(candidate.axis, midpoint);
    if (compareNearly(offset, bestOffset) < 0) {
      bestIndex = index;
      bestOffset = offset;
    }
  });

  const winner = bestIndex < 0 ? undefined : candidates[bestIndex];
  if (winner === undefined) {
    return null;
  }
  claimed.add(bestIndex);
  return winner;
}

/**
 * A region's identity, built from what it is about rather than from where it
 * landed in a list.
 *
 * An index would move the moment detection finds one more axis, and the screen
 * would silently carry a selection over to a different line. A wall votes for at
 * most one axis, so the direction plus the axis's first member is unique and
 * survives the grid growing around it.
 */
function regionId(direction: AxisDirection, anchor: WallId): string {
  return `overlay-deviation-${direction}-${anchor}`;
}

/**
 * Worst first.
 *
 * The tie-break on `id` is not defensive tidiness: the reviewer's fixture holds
 * four 1 mm regions and three 2 mm ones, so without it the panel reorders itself
 * between two renders of the same data. Deviations within a micrometre of each
 * other count as tied — sorting on raw floats would let one ulp decide.
 */
function worstFirst(first: DeviationRegion, second: DeviationRegion): number {
  const bySize = compareNearly(second.deviationMm, first.deviationMm);
  if (bySize !== 0) {
    return bySize;
  }
  // Each model axis is claimed at most once, so no two regions can share an id
  // and the comparator never has to answer "the same region twice".
  return first.id < second.id ? -1 : 1;
}

/**
 * Compare a placed drawing against the model, axis by axis.
 *
 * Each drawing axis is placed in model space, paired with the nearest unclaimed
 * model axis running the same way, and the gap between the two measured with
 * `measureDistance`. The result is ordered worst first.
 *
 * A pair whose model axis carries no member walls produces no region: a
 * deviation with nothing to point at cannot be acted on, and `DetectedAxis`
 * guarantees at least two members for every axis this domain builds.
 */
export function compareDrawingToModel(input: DrawingToModelInput): readonly DeviationRegion[] {
  const labelled = labelAxes(input.modelAxes, input.labelOverrides ?? []);
  const claimed = new Set<number>();
  const regions: DeviationRegion[] = [];

  for (const drawingAxis of input.drawingAxes) {
    const fromMm = midpointOf(drawingAxis, input.transform);
    const partner = claimPartner(fromMm, drawingAxis.direction, labelled, claimed);
    if (partner === null) {
      continue;
    }

    const anchor = partner.axis.wallIds[0];
    if (anchor === undefined) {
      continue;
    }

    const toMm = nearestPointOn(partner.axis, fromMm);
    regions.push({
      id: regionId(partner.axis.direction, anchor),
      reference: partner.label,
      fromMm,
      toMm,
      deviationMm: measureDistance(fromMm, toMm).lengthMm,
      subjectIds: partner.axis.wallIds,
    });
  }

  return regions.sort(worstFirst);
}
