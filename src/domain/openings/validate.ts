/**
 * What makes an opening buildable, and what makes it only unusual.
 *
 * Nothing here changes anything. Every function reads an opening and its wall and
 * answers with sentences: a door 1,5 m tall is reported, never raised to 1,8 m,
 * because the number came from a drawing somebody measured and quietly rounding
 * it would make the model disagree with the survey.
 *
 * The checks fall into two groups, and that split is the whole of the severity
 * scale:
 *
 * - `critical` — the drawing contradicts itself and cannot be built or even drawn
 *   as it stands: a hole reaching past the end of the wall it is cut in, a head
 *   above the top of the wall, two holes in the same place, a size that is not a
 *   positive length.
 * - `warning` — the geometry is sound but off the standards table: a door outside
 *   1,8–2,4 m, a door with a sill, a window sill outside 0,4–1,5 m, an opening
 *   taking more than 80% of the wall. A person may accept any of these; a tall
 *   entrance door is a real thing.
 *
 * The two words are the ones `spatial/integrity.ts` already uses, so a QC screen
 * can pour both lists into one table. They are declared here rather than imported
 * so that validating an opening does not drag in the whole normalised graph.
 *
 * A hole with nothing in it — `void` — is held to the geometric rules and to no
 * standards table: there is no leaf and no glazing to have a standard size, and
 * inventing one would flag every archway on the plan.
 *
 * Every threshold lives in `OPENING_RULES`. Functions take the whole table as
 * their last argument so a project with its own standards passes a different one
 * instead of the numbers being spread through the code.
 */

import { compareNearly } from '../units/compare';
import { millimetres, type Millimetres } from '../units/types';
import type { OpeningId, WallId } from '../spatial/types';
import { centrelineLength, type Wall } from '../walls/types';
import { attachToWall } from './attach';
import {
  describeOpeningKind,
  isAttached,
  isOrphan,
  type AttachedOpening,
  type Opening,
  type OrphanOpening,
  type RelativePosition,
} from './types';

/* -------------------------------------------------------------------------- */
/* The rule table.                                                             */
/* -------------------------------------------------------------------------- */

/** Every threshold an opening is judged against, in one place. */
export interface OpeningRules {
  /** Shortest door leaf a person walks through. */
  readonly doorHeightMinMm: Millimetres;
  /** Tallest door the standards table lists. */
  readonly doorHeightMaxMm: Millimetres;
  /** A door has no sill: the floor runs through. */
  readonly doorSillHeightMm: Millimetres;
  /** Lowest window sill, the point below which a guard is needed instead. */
  readonly windowSillMinMm: Millimetres;
  /** Highest window sill that still looks out of the room. */
  readonly windowSillMaxMm: Millimetres;
  /** Share of the wall length an opening may take, as a fraction. */
  readonly maxWidthShareOfWall: number;
  /** Below this, an opening that shifted has not moved on any drawing. */
  readonly movedToleranceMm: Millimetres;
  /** How far `findOrphans` looks for a wall worth offering. */
  readonly orphanSuggestionRadiusMm: Millimetres;
}

/**
 * The standards this project draws to.
 *
 * `orphanSuggestionRadiusMm` is ten times the radius `attachToWall` uses on its
 * own, and deliberately so: an automatic attach has to be sure, while a
 * suggestion is read by a person who can see both the opening and the wall and
 * say no.
 */
export const OPENING_RULES: OpeningRules = {
  doorHeightMinMm: millimetres(1800),
  doorHeightMaxMm: millimetres(2400),
  doorSillHeightMm: millimetres(0),
  windowSillMinMm: millimetres(400),
  windowSillMaxMm: millimetres(1500),
  maxWidthShareOfWall: 0.8,
  movedToleranceMm: millimetres(1),
  orphanSuggestionRadiusMm: millimetres(1500),
};

/* -------------------------------------------------------------------------- */
/* What a check reports.                                                       */
/* -------------------------------------------------------------------------- */

/** How badly a broken rule hurts. */
export type OpeningSeverity = 'critical' | 'warning';

/** Which check reported the problem. */
export type OpeningRule =
  /** Width or height is not a positive length. */
  | 'sizeNotPositive'
  /** Part of the opening falls outside the wall it is cut in. */
  | 'beyondWallEnd'
  /** The head of the opening sits above the top of the wall. */
  | 'aboveWallTop'
  /** Two openings on one wall take the same stretch of it. */
  | 'overlappingOpenings'
  /** A door outside the standard height range. */
  | 'doorHeight'
  /** A door with a sill; the floor should run through. */
  | 'doorSill'
  /** A window sill outside the standard range. */
  | 'windowSill'
  /** The opening takes more of the wall than the rules allow. */
  | 'widthShareOfWall';

/** One problem found on one opening. */
export interface OpeningViolation {
  readonly rule: OpeningRule;
  readonly severity: OpeningSeverity;
  readonly openingId: OpeningId;
  readonly wallId: WallId;
  /** Vietnamese sentence naming the opening, the wall and the measurement. */
  readonly message: string;
  /** The other opening involved; only `overlappingOpenings` sets it. */
  readonly otherOpeningId?: OpeningId;
}

/** How far along a wall an opening reaches, from the `start` end. */
export interface OpeningSpan {
  readonly centreMm: Millimetres;
  readonly lowMm: Millimetres;
  readonly highMm: Millimetres;
}

/** An orphan, and the wall worth offering the user. */
export interface OrphanReport {
  /** The opening exactly as it was given; nothing is attached for it. */
  readonly opening: OrphanOpening;
  /** The wall to offer, or `null` when none is near enough to suggest. */
  readonly suggestedWallId: WallId | null;
  /** Where it would land on that wall, if it were accepted. */
  readonly suggestedPosition: RelativePosition | null;
  /**
   * Distance from the nearest wall face, whether or not it is near enough to
   * suggest. `null` only when there is no wall with any length at all.
   */
  readonly distanceToFaceMm: Millimetres | null;
  /** Vietnamese sentence for the orphan list. */
  readonly message: string;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

const CRITICAL: OpeningSeverity = 'critical';
const WARNING: OpeningSeverity = 'warning';

/** A length with the Vietnamese decimal comma; whole values keep no decimal. */
function formatLength(valueMm: Millimetres): string {
  const rounded = Math.round(valueMm * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
  return `${text} mm`;
}

/** A range of lengths, with the unit written once: `400–1500 mm`. */
function formatRange(lowMm: Millimetres, highMm: Millimetres): string {
  return `${formatLength(lowMm).replace(' mm', '')}–${formatLength(highMm)}`;
}

/** A fraction read as a whole percentage. */
function formatShare(share: number): string {
  return `${String(Math.round(share * 100))}%`;
}

/** "Cửa đi D-3", for the start of a sentence. */
function nameOf(opening: Opening): string {
  return `${describeOpeningKind(opening.kind)} ${opening.id}`;
}

/** The openings that share a wall with this one, in a fixed order. */
function siblingsOnWall(
  opening: AttachedOpening,
  candidates: readonly Opening[],
): readonly AttachedOpening[] {
  return candidates
    .filter(
      (candidate): candidate is AttachedOpening =>
        isAttached(candidate) &&
        candidate.wallId === opening.wallId &&
        candidate.id !== opening.id,
    )
    .slice()
    .sort((first, second) => (first.id < second.id ? -1 : 1));
}

/** How far two stretches of one wall overlap; zero or less when they are clear. */
function overlapBetween(first: OpeningSpan, second: OpeningSpan): Millimetres {
  return millimetres(Math.min(first.highMm, second.highMm) - Math.max(first.lowMm, second.lowMm));
}

function violation(
  rule: OpeningRule,
  severity: OpeningSeverity,
  opening: AttachedOpening,
  message: string,
  otherOpeningId?: OpeningId,
): OpeningViolation {
  return otherOpeningId === undefined
    ? { rule, severity, openingId: opening.id, wallId: opening.wallId, message }
    : { rule, severity, openingId: opening.id, wallId: opening.wallId, message, otherOpeningId };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Where an opening starts and stops along its wall, in millimetres.
 *
 * The centre comes from the stored fraction, so this moves with the wall like
 * everything else about an opening.
 */
export function openingSpan(wall: Wall, opening: AttachedOpening): OpeningSpan {
  const centreMm = millimetres(opening.relativePosition * centrelineLength(wall));
  const halfWidthMm = opening.widthMm / 2;

  return {
    centreMm,
    lowMm: millimetres(centreMm - halfWidthMm),
    highMm: millimetres(centreMm + halfWidthMm),
  };
}

/**
 * Check one opening against the rules, in a fixed order.
 *
 * The geometric checks come first: they say the drawing is impossible, and a
 * standards warning on an opening that hangs off the end of its wall is not the
 * sentence a person needs to read first.
 *
 * `siblings` may be the whole list of openings on the plan — anything not on this
 * wall is ignored — and only the overlap check reads it, so a caller with one
 * opening in hand can leave it out.
 *
 * @throws Error when the wall is not the one the opening belongs to.
 */
export function validateOpening(
  opening: AttachedOpening,
  wall: Wall,
  siblings: readonly Opening[] = [],
  rules: OpeningRules = OPENING_RULES,
): readonly OpeningViolation[] {
  if (wall.id !== opening.wallId) {
    throw new Error(
      `Opening ${opening.id} belongs to wall ${opening.wallId}, not ${wall.id}; ` +
        'it cannot be checked against this wall.',
    );
  }

  const violations: OpeningViolation[] = [];
  const wallLengthMm = centrelineLength(wall);
  const wallHeightMm = millimetres(wall.topElevationMm - wall.baseElevationMm);
  const span = openingSpan(wall, opening);
  const headMm = millimetres(opening.sillHeightMm + opening.heightMm);

  if (compareNearly(opening.widthMm, 0) <= 0 || compareNearly(opening.heightMm, 0) <= 0) {
    violations.push(
      violation(
        'sizeNotPositive',
        CRITICAL,
        opening,
        `${nameOf(opening)} có kích thước không dùng được: rộng ` +
          `${formatLength(opening.widthMm)}, cao ${formatLength(opening.heightMm)}.`,
      ),
    );
  }

  const overshootMm = millimetres(
    Math.max(0 - span.lowMm, span.highMm - wallLengthMm, 0),
  );
  if (compareNearly(overshootMm, 0) > 0) {
    violations.push(
      violation(
        'beyondWallEnd',
        CRITICAL,
        opening,
        `${nameOf(opening)} vượt ra ngoài tường ${wall.id} mất ${formatLength(overshootMm)}; ` +
          `tường chỉ dài ${formatLength(wallLengthMm)}.`,
      ),
    );
  }

  if (compareNearly(headMm, wallHeightMm) > 0) {
    violations.push(
      violation(
        'aboveWallTop',
        CRITICAL,
        opening,
        `${nameOf(opening)} có đỉnh ở ${formatLength(headMm)}, cao hơn tường ${wall.id} ` +
          `chỉ cao ${formatLength(wallHeightMm)}.`,
      ),
    );
  }

  for (const sibling of siblingsOnWall(opening, siblings)) {
    const overlapMm = overlapBetween(span, openingSpan(wall, sibling));

    if (compareNearly(overlapMm, 0) > 0) {
      violations.push(
        violation(
          'overlappingOpenings',
          CRITICAL,
          opening,
          `${nameOf(opening)} chồng lên ${sibling.id} trên tường ${wall.id} một đoạn ` +
            `${formatLength(overlapMm)}.`,
          sibling.id,
        ),
      );
    }
  }

  if (opening.kind === 'door') {
    if (
      compareNearly(opening.heightMm, rules.doorHeightMinMm) < 0 ||
      compareNearly(opening.heightMm, rules.doorHeightMaxMm) > 0
    ) {
      violations.push(
        violation(
          'doorHeight',
          WARNING,
          opening,
          `${nameOf(opening)} cao ${formatLength(opening.heightMm)}, ngoài khoảng ` +
            `${formatRange(rules.doorHeightMinMm, rules.doorHeightMaxMm)} của cửa đi.`,
        ),
      );
    }

    if (compareNearly(opening.sillHeightMm, rules.doorSillHeightMm) !== 0) {
      violations.push(
        violation(
          'doorSill',
          WARNING,
          opening,
          `${nameOf(opening)} có ngưỡng ${formatLength(opening.sillHeightMm)}; cửa đi phải có ` +
            `ngưỡng ${formatLength(rules.doorSillHeightMm)}.`,
        ),
      );
    }
  }

  if (
    opening.kind === 'window' &&
    (compareNearly(opening.sillHeightMm, rules.windowSillMinMm) < 0 ||
      compareNearly(opening.sillHeightMm, rules.windowSillMaxMm) > 0)
  ) {
    violations.push(
      violation(
        'windowSill',
        WARNING,
        opening,
        `${nameOf(opening)} có ngưỡng ${formatLength(opening.sillHeightMm)}, ngoài khoảng ` +
          `${formatRange(rules.windowSillMinMm, rules.windowSillMaxMm)} của cửa sổ.`,
      ),
    );
  }

  const widthLimitMm = millimetres(rules.maxWidthShareOfWall * wallLengthMm);
  if (compareNearly(opening.widthMm, widthLimitMm) > 0) {
    violations.push(
      violation(
        'widthShareOfWall',
        WARNING,
        opening,
        `${nameOf(opening)} rộng ${formatLength(opening.widthMm)}, quá ` +
          `${formatShare(rules.maxWidthShareOfWall)} chiều dài ${formatLength(wallLengthMm)} ` +
          `của tường ${wall.id}.`,
      ),
    );
  }

  return violations;
}

/**
 * Check every attached opening on a plan.
 *
 * An overlapping pair is reported once, from the opening with the lower id, so a
 * QC list does not show the same overlap twice from both sides.
 *
 * Openings are skipped in two cases, both of which belong to someone else: an
 * orphan has no wall to be judged against and is `findOrphans`' business, and an
 * opening pointing at a wall that is not in the list is a dangling reference,
 * which `spatial/integrity.ts` already reports.
 */
export function validateOpenings(
  openings: readonly Opening[],
  walls: readonly Wall[],
  rules: OpeningRules = OPENING_RULES,
): readonly OpeningViolation[] {
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const violations: OpeningViolation[] = [];
  const reportedPairs = new Set<string>();

  for (const opening of openings) {
    if (!isAttached(opening)) {
      continue;
    }

    const wall = wallsById.get(opening.wallId);

    if (wall === undefined) {
      continue;
    }

    for (const found of validateOpening(opening, wall, openings, rules)) {
      if (found.otherOpeningId === undefined) {
        violations.push(found);
        continue;
      }

      const pair = [found.openingId, found.otherOpeningId].sort().join('|');

      if (!reportedPairs.has(pair)) {
        reportedPairs.add(pair);
        violations.push(found);
      }
    }
  }

  return violations;
}

/**
 * List the openings no wall is holding, each with a wall worth offering.
 *
 * Nothing is attached and nothing is deleted: the opening comes back as the very
 * object that went in, and the suggestion sits beside it for a person to accept.
 * Applying one means calling `attachToWall` with that opening — which is what
 * this function did to find the suggestion in the first place, so the answer a
 * user accepts is the answer they were shown.
 *
 * The search reaches further than an automatic attach does, so a wall the model
 * missed by half a metre is still offered; when nothing is that close, the
 * distance to the nearest wall is still reported, because "the nearest wall is
 * three metres away" tells a person the opening is in the wrong room, not that it
 * needs nudging.
 */
export function findOrphans(
  openings: readonly Opening[],
  walls: readonly Wall[],
  rules: OpeningRules = OPENING_RULES,
): readonly OrphanReport[] {
  const reports: OrphanReport[] = [];

  for (const opening of openings) {
    if (!isOrphan(opening)) {
      continue;
    }

    const suggestion = attachToWall(opening, walls, rules.orphanSuggestionRadiusMm);
    const suggested = isAttached(suggestion.opening) ? suggestion.opening : null;

    reports.push({
      opening,
      suggestedWallId: suggested === null ? null : suggested.wallId,
      suggestedPosition: suggested === null ? null : suggested.relativePosition,
      distanceToFaceMm: suggestion.distanceToFaceMm,
      message: orphanMessage(opening, suggestion.distanceToFaceMm, suggested, rules),
    });
  }

  return reports;
}

function orphanMessage(
  opening: OrphanOpening,
  distanceToFaceMm: Millimetres | null,
  suggested: AttachedOpening | null,
  rules: OpeningRules,
): string {
  if (suggested !== null && distanceToFaceMm !== null) {
    return (
      `${nameOf(opening)} đang mồ côi; có thể gắn vào tường ${suggested.wallId} ` +
      `cách đó ${formatLength(distanceToFaceMm)}.`
    );
  }
  if (distanceToFaceMm !== null) {
    return (
      `${nameOf(opening)} đang mồ côi; tường gần nhất còn cách ` +
      `${formatLength(distanceToFaceMm)}, xa hơn bán kính gợi ý ` +
      `${formatLength(rules.orphanSuggestionRadiusMm)} nên chưa gợi ý được tường nào.`
    );
  }
  return `${nameOf(opening)} đang mồ côi và chưa có tường nào để gợi ý.`;
}
