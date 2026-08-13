/**
 * Guessing what a room is for, and never pretending it is more than a guess.
 *
 * A found room has no name. It has an area, a shape, and a count of the doors
 * that open into it, and from those three a use can be *suggested* — a four
 * square metre space behind a single door is a WC far more often than it is
 * anything else. That inference is worth making, because naming fourteen rooms
 * by hand is the tedious part of the job.
 *
 * It is not worth trusting silently, which is why nothing here returns a name:
 *
 * - Every answer carries a **confidence**, and the confidences are coarse on
 *   purpose. A suggestion at 0,7 says "one clear signal and nothing against
 *   it"; quoting 0,73 would imply a calibration that no rule table has.
 * - **Nothing fitting is an answer.** A thirty-five square metre room with two
 *   doors could be a living room, an office or a workshop; the honest output is
 *   `null`, not the nearest match.
 * - The result is a suggestion **from the model**, so a caller writing it into
 *   the graph must record it as `source: 'ai'` with `reviewed: false`. The
 *   verified green belongs to a person who looked, never to this file.
 *
 * The vocabulary is `RoomUsage` from the spatial graph rather than a private
 * one, so a suggestion can be written straight into a `Room` once a person has
 * approved it, with no translation step to drift out of date.
 *
 * Every function is pure and total: the same signals always give the same
 * suggestion, and no combination of them has no answer.
 */

import type { Confidence, RoomUsage } from '../spatial/types';
import { compareNearly } from '../units/compare';
import { squareMetres, type SquareMetres } from '../units/types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** What is known about a room when its use has to be guessed. */
export interface RoomSignals {
  readonly areaM2: SquareMetres;
  /** Doors opening into the room, however many walls they are spread over. */
  readonly doorCount: number;
  /**
   * `perimeter² ÷ area`, if the shape is known.
   *
   * Sixteen for a square and rising as a shape stretches, so it separates a
   * corridor from a room of the same area without needing either dimension.
   * Left out when the outline is not to hand; it only ever sharpens a
   * suggestion the doors and the area already made.
   */
  readonly slenderness?: number;
}

/** A use the model proposes, and how much of it to believe. */
export interface UsageSuggestion {
  /** The proposed use, or `null` when nothing fits — "không xác định". */
  readonly usage: RoomUsage | null;
  /** Within `[0, 1]`; `0` when nothing fits. */
  readonly confidence: Confidence;
  /** Vietnamese name to offer. Never write this to `Room.name` unapproved. */
  readonly label: string;
  /** Vietnamese sentence saying which signals decided it. */
  readonly reason: string;
}

/**
 * Where one guess stops and the next begins.
 *
 * Exported so a screen can show the rule that fired instead of restating the
 * numbers and drifting out of step with them.
 */
export const USAGE_THRESHOLDS = {
  /** Below this a space is a duct or a shaft rather than a room. */
  servicesMaxAreaM2: squareMetres(2),
  /** A WC or shower room sits between these. */
  bathroomMinAreaM2: squareMetres(2),
  bathroomMaxAreaM2: squareMetres(6),
  /** A bedroom sits between these. */
  bedroomMinAreaM2: squareMetres(9),
  bedroomMaxAreaM2: squareMetres(30),
  /** A bedroom has its own door, and at most one more to a bathroom. */
  bedroomMaxDoorCount: 2,
  /** From this many doors, a space is what other rooms open onto. */
  corridorMinDoorCount: 3,
  /** `perimeter² ÷ area` from which a shape counts as long and thin. */
  corridorMinSlenderness: 25,
} as const;

/**
 * The confidence scale, in words.
 *
 * Four steps, because the rules below can genuinely tell four situations apart
 * and no more. Anything finer would be invented precision.
 */
export const USAGE_CONFIDENCE = {
  /** Two independent signals agree, and nothing contradicts them. */
  strong: 0.85,
  /** One clear signal, within its range, nothing against it. */
  fair: 0.7,
  /** The range fits, but the signal is weak on its own. */
  weak: 0.55,
  /** Nothing fits. */
  none: 0,
} as const;

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Vietnamese names for every use the graph knows, plus the unknown case.
 *
 * A complete record rather than a lookup with a fallback, so adding a use to
 * `RoomUsage` fails the build here instead of quietly showing its English name
 * on a Vietnamese screen.
 */
const USAGE_LABELS: Readonly<Record<RoomUsage, string>> = {
  livingRoom: 'Phòng khách',
  bedroom: 'Phòng ngủ',
  kitchen: 'Bếp',
  bathroom: 'Vệ sinh',
  corridor: 'Hành lang',
  stairwell: 'Thang bộ',
  utility: 'Kỹ thuật',
  other: 'Khác',
};

/** Shown when no rule fits. */
const UNKNOWN_LABEL = 'Không xác định';

function isAtLeast(value: number, threshold: number): boolean {
  return compareNearly(value, threshold) >= 0;
}

function isAtMost(value: number, threshold: number): boolean {
  return compareNearly(value, threshold) <= 0;
}

function isWithin(value: number, low: number, high: number): boolean {
  return isAtLeast(value, low) && isAtMost(value, high);
}

/** Areas read the way the rest of the interface reads them. */
function areaText(areaM2: number): string {
  return `${areaM2.toFixed(2).replace('.', ',')} m²`;
}

function doorText(doorCount: number): string {
  return doorCount === 0 ? 'không có cửa nào' : `${String(doorCount)} cửa`;
}

function suggest(usage: RoomUsage, confidence: Confidence, reason: string): UsageSuggestion {
  return { usage, confidence, label: USAGE_LABELS[usage], reason };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/** The Vietnamese name for a use, or for not knowing. */
export function describeUsage(usage: RoomUsage | null): string {
  return usage === null ? UNKNOWN_LABEL : USAGE_LABELS[usage];
}

/**
 * Suggest what a room is for, from its area and the doors opening into it.
 *
 * The rules are tried in order of how much they prove, not in order of how
 * common the room is: a space with no door at all is a shaft whatever its area
 * says, and a space three doors open into is circulation whatever its area
 * says. Only once those are ruled out does the area get to decide.
 *
 * The answer is never a name. It is a proposal with a confidence attached, and
 * a caller that writes it into the graph must mark it as coming from the model
 * and leave it unreviewed until a person says otherwise.
 */
export function suggestRoomUsage(signals: RoomSignals): UsageSuggestion {
  const { areaM2, doorCount } = signals;
  const slenderness = signals.slenderness;
  const isSlender =
    slenderness !== undefined && isAtLeast(slenderness, USAGE_THRESHOLDS.corridorMinSlenderness);

  if (doorCount === 0 && isAtMost(areaM2, USAGE_THRESHOLDS.servicesMaxAreaM2)) {
    return suggest(
      'utility',
      USAGE_CONFIDENCE.strong,
      `${areaText(areaM2)} và ${doorText(doorCount)}: không vào được thì không phải chỗ ở, ` +
        'gần như chắc chắn là hộp kỹ thuật hoặc ống đứng.',
    );
  }

  if (isAtMost(areaM2, USAGE_THRESHOLDS.servicesMaxAreaM2)) {
    return suggest(
      'utility',
      USAGE_CONFIDENCE.weak,
      `Chỉ ${areaText(areaM2)}, dưới ngưỡng ${areaText(USAGE_THRESHOLDS.servicesMaxAreaM2)}: ` +
        'quá nhỏ để là phòng, nhiều khả năng là khoang kỹ thuật.',
    );
  }

  if (isAtLeast(doorCount, USAGE_THRESHOLDS.corridorMinDoorCount)) {
    return suggest(
      'corridor',
      isSlender ? USAGE_CONFIDENCE.strong : USAGE_CONFIDENCE.fair,
      `${doorText(doorCount)} mở vào đây` +
        (isSlender ? ', và mặt bằng dài và hẹp' : '') +
        ': đây là chỗ các phòng khác đi qua chứ không phải chỗ ở.',
    );
  }

  if (isSlender && doorCount > 0) {
    return suggest(
      'corridor',
      USAGE_CONFIDENCE.weak,
      `Mặt bằng dài và hẹp (${formatRatio(slenderness)}) tuy chỉ có ${doorText(doorCount)}: ` +
        'hình dạng nghiêng về lối đi hơn là phòng.',
    );
  }

  if (
    isWithin(areaM2, USAGE_THRESHOLDS.bathroomMinAreaM2, USAGE_THRESHOLDS.bathroomMaxAreaM2) &&
    doorCount === 1
  ) {
    return suggest(
      'bathroom',
      USAGE_CONFIDENCE.fair,
      `${areaText(areaM2)} sau đúng một cửa, nằm trong khoảng ` +
        `${areaText(USAGE_THRESHOLDS.bathroomMinAreaM2)}–${areaText(USAGE_THRESHOLDS.bathroomMaxAreaM2)} ` +
        'của khu vệ sinh.',
    );
  }

  if (
    isWithin(areaM2, USAGE_THRESHOLDS.bedroomMinAreaM2, USAGE_THRESHOLDS.bedroomMaxAreaM2) &&
    doorCount >= 1 &&
    isAtMost(doorCount, USAGE_THRESHOLDS.bedroomMaxDoorCount)
  ) {
    return suggest(
      'bedroom',
      doorCount === 1 ? USAGE_CONFIDENCE.fair : USAGE_CONFIDENCE.weak,
      `${areaText(areaM2)} với ${doorText(doorCount)}, nằm trong khoảng ` +
        `${areaText(USAGE_THRESHOLDS.bedroomMinAreaM2)}–${areaText(USAGE_THRESHOLDS.bedroomMaxAreaM2)} ` +
        'của phòng ngủ.',
    );
  }

  return {
    usage: null,
    confidence: USAGE_CONFIDENCE.none,
    label: UNKNOWN_LABEL,
    reason:
      `${areaText(areaM2)} với ${doorText(doorCount)} không rơi vào quy tắc nào: ` +
      'chưa đủ căn cứ để đoán, cần người xem.',
  };
}

/** A slenderness read back as a plain number, for the reason line. */
function formatRatio(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(1).replace('.', ',');
}
