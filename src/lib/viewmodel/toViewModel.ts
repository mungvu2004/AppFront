/**
 * Turning the model into something a view can draw.
 *
 * This is the only place where a `Wall` becomes a card. Everything downstream of
 * it — every component in `src/components`, every screen in `src/screens` — sees
 * finished strings and codes, never a millimetre, never a confidence score,
 * never a colour. See `./types` for why that boundary is drawn here and for the
 * mapping between the field names in the brief and the English ones invariant
 * E.11 requires.
 *
 * Three decisions shape the file.
 *
 * **Every reading is built as a pair, not split from a sentence.** `formatLength`
 * in `src/lib/format/measure` returns `"3,45 m"` — the number and its unit
 * already joined. A {@link ViewAttribute} needs them apart, so the view can set
 * the unit smaller than the figure. Rather than cut the suffix back off a
 * formatted string, the builders here compose the same two halves the formatter
 * composes: `formatNumber` writes the figure, and the unit is attached beside
 * it. The unit is chosen by the same rule `formatLength` uses, from the same
 * exported {@link METRE_THRESHOLD_MM}, and the test file pins the result — every
 * measured attribute must rejoin into exactly the string the canonical formatter
 * would have produced. The two cannot drift without a red test.
 *
 * **Nothing throws.** A view model sits in a render path, and QC data is exactly
 * where a `NaN` coordinate or a missing area turns up. Every reading that cannot
 * be written comes back as the placeholder dash with no unit, and a room whose
 * outline is corrupt still renders its name and its status.
 *
 * **Status is derived, never passed in.** {@link ViewModel.statusCode} follows
 * invariant A5: `verified` is set from `reviewed`, which the graph only allows a
 * person to set, and no confidence score — however high — can reach it.
 *
 * Every function here is pure. Nothing reads the store, nothing reads the clock,
 * and the same entity always gives the same model.
 */

import { OPENING_KIND_LABELS } from '@/domain/openings/types';
import { ROOM_USAGE_LABELS, RULE_SEVERITY_LABELS, type RuleSeverity, type Violation } from '@/domain/rules/registry';
import type {
  Opening,
  OpeningKind,
  Point,
  ReviewMetadata,
  Room,
  Segment,
  SwingDirection,
  Wall,
  WallKind,
} from '@/domain/spatial/types';
import { MILLIMETRES_PER_METRE } from '@/domain/units/types';
import { METRE_THRESHOLD_MM } from '@/lib/format/measure';
import { formatNumber, isFormattable, MISSING_VALUE, type MaybeNumber } from '@/lib/format/number';
import { confidenceLevel } from '@/lib/format/semantic';

import type { ViewAttribute, ViewIconCode, ViewModel, ViewModelInput, ViewStatusCode } from './types';

/* -------------------------------------------------------------------------- */
/* Units and precision.                                                        */
/* -------------------------------------------------------------------------- */

/** The unit symbols a reading can carry. Written beside the value, never in it. */
const UNIT_MILLIMETRE = 'mm';
const UNIT_METRE = 'm';
const UNIT_SQUARE_METRE = 'm²';
const UNIT_PERCENT = '%';

/**
 * Decimals each reading keeps.
 *
 * These mirror the constants inside `src/lib/format/measure`, which does not
 * export them. The test file rejoins every measured attribute and compares it
 * against that module's own output, so a change there fails here rather than
 * quietly showing a wall to three decimals in one panel and none in another.
 */
const MILLIMETRE_FRACTION_DIGITS = 0;
const METRE_FRACTION_DIGITS = 2;
const AREA_FRACTION_DIGITS = 2;
const COUNT_FRACTION_DIGITS = 0;
const PERCENT_FRACTION_DIGITS = 0;

/** A ratio on the 0–1 scale, written as a percentage. */
const PERCENT_SCALE = 100;

/* -------------------------------------------------------------------------- */
/* Building one reading.                                                       */
/* -------------------------------------------------------------------------- */

/** A reading that could not be written: the dash alone, with no unit after it. */
function missingAttribute(label: string): ViewAttribute {
  return { label, value: MISSING_VALUE };
}

/**
 * Text that is already finished, such as a rule code or a swing direction.
 *
 * An empty or absent string is a missing reading, not an empty cell: a blank
 * where a value belongs reads as a rendering fault, the dash reads as "not
 * known yet".
 */
function textAttribute(label: string, value: string | null | undefined): ViewAttribute {
  const trimmed = value?.trim() ?? '';

  return trimmed === '' ? missingAttribute(label) : { label, value: trimmed };
}

/** A plain count — walls on a room, openings in a wall. No unit. */
function countAttribute(label: string, value: MaybeNumber): ViewAttribute {
  return isFormattable(value)
    ? { label, value: formatNumber(value, { fractionDigits: COUNT_FRACTION_DIGITS }) }
    : missingAttribute(label);
}

/**
 * A length held in millimetres, written the way the drawing writes it.
 *
 * Under one metre it stays in millimetres and whole; from one metre it converts
 * and keeps two decimals. That is `formatLength`'s rule, applied to the same
 * threshold, and split into the two halves a view needs separately.
 */
function lengthAttribute(label: string, valueMm: MaybeNumber): ViewAttribute {
  if (!isFormattable(valueMm)) {
    return missingAttribute(label);
  }

  if (Math.abs(valueMm) < METRE_THRESHOLD_MM) {
    return {
      label,
      value: formatNumber(valueMm, { fractionDigits: MILLIMETRE_FRACTION_DIGITS }),
      unit: UNIT_MILLIMETRE,
    };
  }

  return {
    label,
    value: formatNumber(valueMm / MILLIMETRES_PER_METRE, { fractionDigits: METRE_FRACTION_DIGITS }),
    unit: UNIT_METRE,
  };
}

/** An area held in square metres, to two decimals — the 248,60 m² of the sample set. */
function areaAttribute(label: string, areaM2: MaybeNumber): ViewAttribute {
  return isFormattable(areaM2)
    ? { label, value: formatNumber(areaM2, { fractionDigits: AREA_FRACTION_DIGITS }), unit: UNIT_SQUARE_METRE }
    : missingAttribute(label);
}

/** A proportion on the 0–1 scale, written as a whole percentage. */
function ratioAttribute(label: string, ratio: MaybeNumber): ViewAttribute {
  return isFormattable(ratio)
    ? {
        label,
        value: formatNumber(ratio * PERCENT_SCALE, { fractionDigits: PERCENT_FRACTION_DIGITS }),
        unit: UNIT_PERCENT,
      }
    : missingAttribute(label);
}

/* -------------------------------------------------------------------------- */
/* Geometry the labels need.                                                   */
/* -------------------------------------------------------------------------- */

/** The length of a centreline, or `null` when a coordinate is unusable. */
function segmentLengthMm(segment: Segment): number | null {
  const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);

  return Number.isFinite(length) ? length : null;
}

/**
 * The distance round a room outline, closing back to the first corner.
 *
 * `computePerimeter` in `src/domain/rooms/area` does the same sum, but on the
 * labelled `PointMm` of the units module, and the constructor that labels a bare
 * coordinate throws on a value that is not finite. A view model may not throw,
 * so the sum is done here on the graph's plain points and an unusable outline
 * comes back as `null` — the room still renders, with a dash where its perimeter
 * would be.
 */
function outlinePerimeterMm(outline: readonly Point[]): number | null {
  if (outline.length < 2) {
    return null;
  }

  let total = 0;

  for (let index = 0; index < outline.length; index += 1) {
    const from = outline[index];
    const to = outline[(index + 1) % outline.length];

    if (from === undefined || to === undefined) {
      return null;
    }

    total += Math.hypot(to.x - from.x, to.y - from.y);
  }

  return Number.isFinite(total) ? total : null;
}

/* -------------------------------------------------------------------------- */
/* Status, and the rule that guards the verified green.                        */
/* -------------------------------------------------------------------------- */

/**
 * Which of the four codes an entity of the graph asks for.
 *
 * `verified` comes from `reviewed` and from nothing else. The graph only lets a
 * person set that flag — AI output must never set it — so invariant A5 holds by
 * construction here: an AI result at 99% confidence is `neutral`, never green.
 *
 * Everything below AI-certain is `attention`, because an unapproved reading the
 * model is unsure about is exactly what a reviewer is looking for. `violation`
 * is reserved for a broken rule and is never derived from a score.
 */
function reviewStatus(review: ReviewMetadata): ViewStatusCode {
  if (review.reviewed) {
    return 'verified';
  }

  return confidenceLevel(review.confidence) === 'certain' ? 'neutral' : 'attention';
}

/** The confidence reading every graph entity carries. */
function confidenceAttribute(review: ReviewMetadata): ViewAttribute {
  return ratioAttribute('Độ tin cậy', review.confidence);
}

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Vietnamese names for the graph's wall kinds.
 *
 * The same three strings exist in `src/lib/commands/business/shared`, which is
 * the command layer; a display module must not depend on the layer that mutates
 * the drawing, so the table is restated rather than imported. The test file
 * compares the two maps, so the copy cannot drift from the original.
 *
 * A complete `Record` rather than a lookup with a fallback: adding a kind fails
 * the build here instead of showing its English name on screen.
 */
const WALL_KIND_LABELS: Readonly<Record<WallKind, string>> = {
  loadBearing: 'tường chịu lực',
  partition: 'vách ngăn',
  envelope: 'tường bao',
};

const WALL_ICON_CODES: Readonly<Record<WallKind, ViewIconCode>> = {
  loadBearing: 'wallLoadBearing',
  partition: 'wallPartition',
  envelope: 'wallEnvelope',
};

const OPENING_ICON_CODES: Readonly<Record<OpeningKind, ViewIconCode>> = {
  door: 'openingDoor',
  window: 'openingWindow',
};

/** How the leaf opens, as a reader of the plan says it. */
const SWING_LABELS: Readonly<Record<SwingDirection, string>> = {
  left: 'mở trái',
  right: 'mở phải',
  double: 'hai cánh',
  sliding: 'trượt',
  fixed: 'cố định',
};

/**
 * How badly a broken rule reads on screen.
 *
 * Only `critical` earns the violation red. A warning asks for attention, and a
 * suggestion is neutral — colouring every finding red would leave a QC sheet
 * with nothing to draw the eye to.
 */
const VIOLATION_STATUS_CODES: Readonly<Record<RuleSeverity, ViewStatusCode>> = {
  critical: 'violation',
  warning: 'attention',
  suggestion: 'neutral',
};

const VIOLATION_ICON_CODES: Readonly<Record<RuleSeverity, ViewIconCode>> = {
  critical: 'violationCritical',
  warning: 'violationWarning',
  suggestion: 'violationSuggestion',
};

/** Shown as the headline of a room that has no name yet. */
export const UNNAMED_ROOM_LABEL = 'Phòng chưa đặt tên';

/**
 * What joins a rule code to an entity code in a violation's key.
 *
 * A violation has no id of its own — the same rule can be broken by forty walls,
 * and the same wall can break four rules — so the pair is the key.
 */
export const VIOLATION_ID_SEPARATOR = ':';

/* -------------------------------------------------------------------------- */
/* The four builders.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A wall, ready to draw.
 *
 * @example
 * toWallViewModel(wall)
 * // { id: 'W-014', label: 'Tường W-014', secondaryLine: 'tường chịu lực',
 * //   attributes: [{ label: 'Bề dày', value: '220', unit: 'mm' }, …],
 * //   statusCode: 'verified', iconCode: 'wallLoadBearing' }
 */
export function toWallViewModel(wall: Wall): ViewModel {
  return {
    id: wall.id,
    label: `Tường ${wall.id}`,
    secondaryLine: WALL_KIND_LABELS[wall.kind],
    attributes: [
      lengthAttribute('Bề dày', wall.thicknessMm),
      lengthAttribute('Chiều dài', segmentLengthMm(wall.centreline)),
      lengthAttribute('Chiều cao', wall.heightMm),
      countAttribute('Ô mở', wall.openingIds.length),
      confidenceAttribute(wall),
    ],
    statusCode: reviewStatus(wall),
    iconCode: WALL_ICON_CODES[wall.kind],
  };
}

/**
 * An opening, ready to draw.
 *
 * The host wall is the supporting line rather than an attribute: an opening is
 * only ever read together with the wall it is cut into.
 */
export function toOpeningViewModel(opening: Opening): ViewModel {
  return {
    id: opening.id,
    label: `${OPENING_KIND_LABELS[opening.kind]} ${opening.id}`,
    secondaryLine: `trên tường ${opening.wallId}`,
    attributes: [
      lengthAttribute('Bề rộng', opening.widthMm),
      lengthAttribute('Chiều cao', opening.heightMm),
      lengthAttribute('Cao bệ', opening.sillHeightMm),
      lengthAttribute('Vị trí trên tường', opening.offsetMm),
      textAttribute('Chiều mở', SWING_LABELS[opening.swing]),
      confidenceAttribute(opening),
    ],
    statusCode: reviewStatus(opening),
    iconCode: OPENING_ICON_CODES[opening.kind],
  };
}

/**
 * A room, ready to draw.
 *
 * The area is the figure the graph stores, not one recomputed from the outline:
 * `src/domain/rooms/area` rounds once, at the end, and re-deriving it here would
 * be a second rounding of the same measurement.
 */
export function toRoomViewModel(room: Room): ViewModel {
  const name = room.name.trim();

  return {
    id: room.id,
    label: name === '' ? UNNAMED_ROOM_LABEL : name,
    secondaryLine: ROOM_USAGE_LABELS[room.usage],
    attributes: [
      areaAttribute('Diện tích', room.areaM2),
      lengthAttribute('Chu vi', outlinePerimeterMm(room.outline)),
      countAttribute('Tường bao', room.wallIds.length),
      confidenceAttribute(room),
    ],
    statusCode: reviewStatus(room),
    iconCode: 'room',
  };
}

/**
 * A violation, ready to draw.
 *
 * The message is the headline and the suggestion is the line under it, because
 * that is the order a reviewer reads them in: what is wrong, then what to do.
 * The rule code stays an attribute — upper case, which invariant A6 allows for
 * an error code and for nothing else on the screen.
 */
export function toViolationViewModel(violation: Violation): ViewModel {
  return {
    id: `${violation.ruleCode}${VIOLATION_ID_SEPARATOR}${violation.entityId}`,
    label: violation.message,
    secondaryLine: violation.suggestion,
    attributes: [
      textAttribute('Mã luật', violation.ruleCode),
      textAttribute('Mức độ', RULE_SEVERITY_LABELS[violation.severity]),
      textAttribute('Đối tượng', violation.entityId),
      textAttribute('Tầng', violation.levelId),
    ],
    statusCode: VIOLATION_STATUS_CODES[violation.severity],
    iconCode: VIOLATION_ICON_CODES[violation.severity],
  };
}

/* -------------------------------------------------------------------------- */
/* One way in.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The view model for any of the four kinds.
 *
 * The tagged input is what lets a mixed list — a QC panel showing walls, rooms
 * and the violations against them — go through one `map` and come out as one
 * kind of card.
 *
 * @example
 * toViewModel({ kind: 'room', room })
 */
export function toViewModel(input: ViewModelInput): ViewModel {
  switch (input.kind) {
    case 'wall':
      return toWallViewModel(input.wall);
    case 'opening':
      return toOpeningViewModel(input.opening);
    case 'room':
      return toRoomViewModel(input.room);
    case 'violation':
      return toViolationViewModel(input.violation);
  }
}

/** Every input, in the order it was given. */
export function toViewModels(inputs: readonly ViewModelInput[]): ViewModel[] {
  return inputs.map(toViewModel);
}
