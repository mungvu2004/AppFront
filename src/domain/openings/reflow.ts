/**
 * Carrying openings along when the wall under them changes.
 *
 * A wall gets dragged shorter, stretched, turned, or cut in two, and the doors
 * and windows on it have to end up somewhere sensible. Somewhere sensible never
 * means gone: an opening that no longer fits is marked, reported and left for a
 * person, because a door that vanishes when a wall is trimmed is a door nobody
 * notices is missing until the drawing is on site.
 *
 * **The stored fraction is what is kept.** An opening is a fraction of its
 * centreline (see `types.ts`), so a wall that changes shape carries its openings
 * proportionally and nothing has to be recomputed. The alternative — holding each
 * opening at a fixed distance from one end — was rejected on purpose: it needs a
 * rule for which end is the anchor, and every wall edit that moves both ends has
 * no answer to that. Keeping the fraction has one rule, applies to every edit,
 * and is the form the data is already in.
 *
 * Keeping the fraction does mean an opening moves on the plan, so the change log
 * says by how much: a door a quarter along a four metre wall sits 1000 mm from
 * the corner, and a quarter along a two metre wall sits at 500 mm. It is still on
 * the wall, and it has still moved 500 mm — both facts are reported, one as the
 * status `moved`, the other as `driftMm`.
 *
 * Three rules shape what happens next.
 *
 * - **Something poking out gets pulled in.** An opening whose width now runs past
 *   the end of the wall slides back until it is inside, and says so.
 * - **Nothing moves when a person has to decide.** An opening wider than the wall
 *   it is on, or lying across a cut, keeps the position it had. Nudging it would
 *   hide the very thing the flag is raising.
 * - **A cut sends each opening to the piece holding its centre.** One that
 *   straddles the cut goes to the piece its centre is in and is flagged for a
 *   decision, since only a person can say whether it is one door in the wrong
 *   place or two openings that were traced as one.
 *
 * Every function is pure: the openings and walls that go in are never written to,
 * and the same arguments always give the same answer.
 */

import { compareNearly, isNearlyZero, nearlyEqualPoint, type PointMm } from '../units/compare';
import { distanceBetween } from '../units/snap';
import type { Millimetres } from '../units/types';
import type { OpeningId } from '../spatial/types';
import { centrelineLength, type Wall } from '../walls/types';
import { placeOnWall } from './attach';
import { OPENING_RULES, type OpeningRules } from './validate';
import {
  clampRelativePosition,
  describeOpeningKind,
  isAttached,
  RELATIVE_POSITION_EPSILON,
  type AttachedOpening,
  type Opening,
  type RelativePosition,
} from './types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                              */
/* -------------------------------------------------------------------------- */

/** What became of one opening after the wall changed. */
export type ReflowStatus =
  /** Still exactly where it was, on a wall that did not move under it. */
  | 'unchanged'
  /** Still on the wall, but not where it was on the plan. */
  | 'moved'
  /** Kept as it was, because only a person can resolve it. */
  | 'needsDecision';

/** Vietnamese names for the three outcomes. */
export const REFLOW_STATUS_LABELS: Readonly<Record<ReflowStatus, string>> = {
  unchanged: 'Giữ nguyên',
  moved: 'Đã dịch chuyển',
  needsDecision: 'Cần người dùng quyết định',
};

/** The Vietnamese name for an outcome. */
export function describeReflowStatus(status: ReflowStatus): string {
  return REFLOW_STATUS_LABELS[status];
}

/** Why an opening ended up with the status it has. */
export type ReflowReason =
  /** The fraction was kept and the wall did not move it anywhere. */
  | 'positionKept'
  /** The fraction was kept, and the new shape of the wall moved the opening. */
  | 'wallReshaped'
  /** The opening ran past the end of the wall and was pulled back inside. */
  | 'slidInsideWall'
  /** Sent to the piece holding its centre, but it lies across the cut. */
  | 'straddlesCut'
  /** Wider than the wall it is on, so there is no position that fits. */
  | 'openingWiderThanWall'
  /** The wall has no length left to sit on. */
  | 'wallHasNoLength';

/** One reviewable entry: an opening before and after the edit. */
export interface ReflowChange {
  readonly before: AttachedOpening;
  readonly after: AttachedOpening;
  readonly status: ReflowStatus;
  readonly reason: ReflowReason;
  /** How far the centre of the opening moved on the plan. */
  readonly driftMm: Millimetres;
  /** Vietnamese sentence naming the opening, the wall and the measurement. */
  readonly message: string;
}

/** What the reflow produced. */
export interface ReflowResult {
  /**
   * The openings of that wall, updated and ready to patch.
   *
   * Only the ones the edit concerned: orphans and openings of other walls are not
   * touched and do not appear here.
   */
  readonly openings: readonly AttachedOpening[];
  /** One entry per opening above, in the same order. */
  readonly changes: readonly ReflowChange[];
  /** The openings a person has to look at before the plan can be trusted. */
  readonly needsDecision: readonly OpeningId[];
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                 */
/* -------------------------------------------------------------------------- */

/** Everything one opening's landing depends on. */
interface LandingRequest {
  readonly opening: AttachedOpening;
  /** The wall it is landing on: the edited wall, or one piece of a cut one. */
  readonly wall: Wall;
  /** Where the kept fraction says it should go. */
  readonly proposed: RelativePosition;
  /** Where it sat on the plan before the edit. */
  readonly previousCentre: PointMm;
  /** Whether an opening running past the end may be pulled back in. */
  readonly slide: boolean;
  /** A reason that outranks whatever the geometry says, or `null`. */
  readonly override: ReflowReason | null;
  readonly rules: OpeningRules;
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
function nameOf(opening: AttachedOpening): string {
  return `${describeOpeningKind(opening.kind).toLowerCase()} ${opening.id}`;
}

/** Half the width of an opening, as a fraction of the wall it sits on. */
function halfSpanShare(opening: AttachedOpening, wallLengthMm: Millimetres): number {
  return opening.widthMm / 2 / wallLengthMm;
}

/** The openings the edit concerns, in the order they were given. */
function hostedBy(openings: readonly Opening[], wall: Wall): readonly AttachedOpening[] {
  return openings.filter(
    (opening): opening is AttachedOpening => isAttached(opening) && opening.wallId === wall.id,
  );
}

/** Where the opening lands, and the first reason that applies to it. */
function land(
  opening: AttachedOpening,
  wall: Wall,
  proposed: RelativePosition,
  slide: boolean,
): { readonly position: RelativePosition; readonly reason: ReflowReason } {
  const kept = clampRelativePosition(proposed);
  const wallLengthMm = centrelineLength(wall);

  if (isNearlyZero(wallLengthMm)) {
    return { position: kept, reason: 'wallHasNoLength' };
  }
  if (compareNearly(opening.widthMm, wallLengthMm) > 0) {
    return { position: kept, reason: 'openingWiderThanWall' };
  }
  if (!slide) {
    return { position: kept, reason: 'positionKept' };
  }

  const halfSpan = halfSpanShare(opening, wallLengthMm);
  const fitted = Math.min(1 - halfSpan, Math.max(halfSpan, kept));

  return compareNearly(fitted, kept, RELATIVE_POSITION_EPSILON) === 0
    ? { position: kept, reason: 'positionKept' }
    : { position: fitted, reason: 'slidInsideWall' };
}

function messageFor(change: Omit<ReflowChange, 'message'>, wall: Wall): string {
  const { before, after, reason, driftMm } = change;
  const moved = `đã dịch chuyển ${formatLength(driftMm)}`;

  switch (reason) {
    case 'positionKept':
      return `Giữ nguyên ${nameOf(after)} tại vị trí tương đối ${formatRelative(
        after.relativePosition,
      )} trên tường ${wall.id}.`;
    case 'wallReshaped':
      return (
        `${describeOpeningKind(after.kind)} ${after.id} giữ nguyên vị trí tương đối ` +
        `${formatRelative(after.relativePosition)} nhưng ${moved} theo tường ${wall.id}.`
      );
    case 'slidInsideWall':
      return (
        `${describeOpeningKind(after.kind)} ${after.id} đã được kéo về trong lòng tường ` +
        `${wall.id}, từ vị trí tương đối ${formatRelative(before.relativePosition)} về ` +
        `${formatRelative(after.relativePosition)}, ${moved}.`
      );
    case 'straddlesCut':
      return (
        `${describeOpeningKind(after.kind)} ${after.id} nằm vắt qua điểm cắt nên cần người ` +
        `dùng quyết định; tạm để trên đoạn ${wall.id} chứa tâm của nó.`
      );
    case 'openingWiderThanWall':
      return (
        `${describeOpeningKind(after.kind)} ${after.id} rộng ${formatLength(after.widthMm)}, ` +
        `quá chiều dài ${formatLength(centrelineLength(wall))} của tường ${wall.id} nên cần ` +
        'người dùng quyết định; chưa dịch chuyển gì.'
      );
    case 'wallHasNoLength':
      return (
        `Tường ${wall.id} không còn chiều dài nào nên ${nameOf(after)} cần người dùng ` +
        'quyết định; chưa dịch chuyển gì.'
      );
  }
}

/** The outcome each reason belongs to; the mapping is the whole of the scale. */
function statusOf(reason: ReflowReason): ReflowStatus {
  switch (reason) {
    case 'positionKept':
      return 'unchanged';
    case 'wallReshaped':
    case 'slidInsideWall':
      return 'moved';
    case 'straddlesCut':
    case 'openingWiderThanWall':
    case 'wallHasNoLength':
      return 'needsDecision';
  }
}

/** Resolve one opening against the wall it is landing on. */
function resolveChange(request: LandingRequest): ReflowChange {
  const { opening, wall, proposed, previousCentre, slide, override, rules } = request;
  const landing = land(opening, wall, proposed, slide);
  const position = override === null ? landing.position : clampRelativePosition(proposed);
  const after: AttachedOpening = { ...opening, wallId: wall.id, relativePosition: position };
  const driftMm = distanceBetween(previousCentre, placeOnWall(wall, position));
  const drifted = compareNearly(driftMm, rules.movedToleranceMm) >= 0;

  // Drift only has a say when nothing more specific happened: an opening that was
  // pulled back inside the wall has moved for that reason, not because the wall
  // changed shape around it.
  const reason: ReflowReason =
    override ?? (landing.reason === 'positionKept' && drifted ? 'wallReshaped' : landing.reason);

  const withoutMessage = { before: opening, after, status: statusOf(reason), reason, driftMm };

  return { ...withoutMessage, message: messageFor(withoutMessage, wall) };
}

function resultOf(changes: readonly ReflowChange[]): ReflowResult {
  return {
    openings: changes.map((change) => change.after),
    changes,
    needsDecision: changes
      .filter((change) => change.status === 'needsDecision')
      .map((change) => change.after.id),
  };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Carry the openings of one wall onto the edited version of that wall.
 *
 * The stored fraction is kept, so every opening stays the same share of the way
 * along the wall and rides with it as it is dragged, stretched or turned. An
 * opening whose width now runs past an end is pulled back inside; one that cannot
 * fit at all keeps its position and is listed in `needsDecision`. Nothing is ever
 * dropped: every opening that went in comes back out.
 *
 * Openings belonging to other walls, and orphans, are left alone and are not part
 * of the result.
 *
 * @throws Error when the two walls are not the same wall before and after.
 * @throws RangeError when a stored position is not a fraction within `[0, 1]`.
 */
export function reflowOpenings(
  previousWall: Wall,
  nextWall: Wall,
  openings: readonly Opening[],
  rules: OpeningRules = OPENING_RULES,
): ReflowResult {
  if (previousWall.id !== nextWall.id) {
    throw new Error(
      `Reflow needs one wall before and after the edit, got ${previousWall.id} and ` +
        `${nextWall.id}; moving openings between walls is an attach, not a reflow.`,
    );
  }

  return resultOf(
    hostedBy(openings, previousWall).map((opening) =>
      resolveChange({
        opening,
        wall: nextWall,
        proposed: opening.relativePosition,
        previousCentre: placeOnWall(previousWall, opening.relativePosition),
        slide: true,
        override: null,
        rules,
      }),
    ),
  );
}

/**
 * Share the openings of a wall out between the two pieces it was cut into.
 *
 * Each opening goes to the piece holding its centre, and its fraction is
 * re-expressed against that piece, so nothing moves on the plan: the pieces cover
 * exactly the run the original did. An opening lying across the cut goes to the
 * piece its centre is in and is flagged `needsDecision` — it is left exactly where
 * it was, because whether it should be shortened, moved off the joint or split in
 * two is not something geometry can answer.
 *
 * An opening whose centre falls exactly on the cut goes to the first piece, so two
 * runs of the same import agree.
 *
 * The pieces must be the two halves of that wall, as `splitWall` returns them:
 * meeting at the cut and covering the original between them. Anything else is
 * refused rather than guessed at, because a wrong assumption here would silently
 * move every opening on the wall.
 *
 * @throws Error when the pieces share an id, do not meet, or do not cover the
 * original wall.
 * @throws RangeError when the original wall has no length, or the cut sits on one
 * of its ends.
 */
export function reflowOpeningsAcrossSplit(
  originalWall: Wall,
  pieces: readonly [Wall, Wall],
  openings: readonly Opening[],
  rules: OpeningRules = OPENING_RULES,
): ReflowResult {
  const [first, second] = pieces;

  if (first.id === second.id) {
    throw new Error(`Both pieces of wall ${originalWall.id} carry the id ${first.id}.`);
  }
  if (!nearlyEqualPoint(first.centreline.end, second.centreline.start)) {
    throw new Error(
      `Pieces ${first.id} and ${second.id} do not meet at the cut, so the openings of ` +
        `wall ${originalWall.id} cannot be shared out between them.`,
    );
  }
  if (
    !nearlyEqualPoint(first.centreline.start, originalWall.centreline.start) ||
    !nearlyEqualPoint(second.centreline.end, originalWall.centreline.end)
  ) {
    throw new Error(
      `Pieces ${first.id} and ${second.id} do not cover wall ${originalWall.id} end to end.`,
    );
  }

  const wallLengthMm = centrelineLength(originalWall);

  if (isNearlyZero(wallLengthMm)) {
    throw new RangeError(`Wall ${originalWall.id} has no length to cut.`);
  }

  const cutAt =
    distanceBetween(originalWall.centreline.start, first.centreline.end) / wallLengthMm;

  if (compareNearly(cutAt, 0, RELATIVE_POSITION_EPSILON) <= 0 || compareNearly(cutAt, 1, RELATIVE_POSITION_EPSILON) >= 0) {
    throw new RangeError(
      `The cut of wall ${originalWall.id} sits on one of its ends, at ${formatRelative(cutAt)}.`,
    );
  }

  return resultOf(
    hostedBy(openings, originalWall).map((opening) => {
      const position = opening.relativePosition;
      const halfSpan = halfSpanShare(opening, wallLengthMm);
      const straddlesCut =
        compareNearly(cutAt, position - halfSpan) > 0 && compareNearly(cutAt, position + halfSpan) < 0;
      const onFirstPiece = compareNearly(position, cutAt) <= 0;
      const piece = onFirstPiece ? first : second;

      return resolveChange({
        opening,
        wall: piece,
        proposed: onFirstPiece ? position / cutAt : (position - cutAt) / (1 - cutAt),
        previousCentre: placeOnWall(originalWall, position),
        slide: !straddlesCut,
        override: straddlesCut ? 'straddlesCut' : null,
        rules,
      });
    }),
  );
}
