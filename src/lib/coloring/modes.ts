/**
 * Seven ways to colour a model, and the rule that colour means something.
 *
 * A digital twin is not a picture of a building, it is a question asked of one.
 * "Which rooms are too small", "which walls has nobody checked", "how sure was
 * the pipeline about this floor" — each is a different question, and each wants
 * the same geometry painted differently. A colouring mode is one such question,
 * expressed as a function from an object to a token name.
 *
 * Every mode obeys three rules, and the types enforce all three:
 *
 * - **A mode returns a token name, never a colour.** {@link ColoringMode.paint}
 *   returns a {@link ColorTokenName} — the name of a CSS variable declared in
 *   `src/styles/globals.css`. A hex value cannot be returned because it does not
 *   typecheck. Which pixels that token resolves to is the renderer's business,
 *   and the same answer serves the 2D canvas, the 3D materials and the legend.
 * - **A scale is at most five steps.** See `./scales` for why five, and why the
 *   quantitative modes cut at the quantiles of the data on screen rather than at
 *   fixed thresholds.
 * - **The verified green is never spent on an AI score.** Invariant A5 reserves
 *   `--state-verified` for something a person approved. Only
 *   {@link ColoringModeId} `reviewState` can emit it, and only from the
 *   `reviewed` flag, which the graph lets nothing but a person set. The
 *   `aiConfidence` mode paints a 99%-certain guess in a neutral, exactly like a
 *   40% one but darker — because certainty is not approval. The test file pins
 *   this for every mode.
 *
 * Nothing here is stateful, reads a store, reads the clock, or touches Three.js.
 * A mode is built from a list of objects and is then a pure lookup; the same
 * object always paints the same token.
 *
 * ## Which modes recompute their boundaries
 *
 * `area` and `aiConfidence` are the quantity modes. Their five bands are cut at
 * the quantiles of **the objects passed in** — the ones currently in view — so
 * filtering the view to one level re-cuts every boundary against that level's
 * own spread. {@link ColoringMode.breaks} carries the cut points so a legend can
 * show the numbers this view was actually cut at.
 *
 * `level` is ordinal but not a quantity: a floor is the third floor whether the
 * view holds four walls on it or four hundred, so its bands come from the stack
 * of levels rather than from how many objects sit on each. Cutting it by
 * quantile would make a floor's colour depend on how much furniture was drawn on
 * it, which is not a fact about the floor.
 *
 * `default`, `roomUsage`, `reviewState` and `violationSeverity` are categorical:
 * their bands are fixed by the vocabulary they read, not by the data.
 *
 * ## Field names
 *
 * The brief for this module names the painting function `mau(doiTuong)`.
 * Invariants B and E.11 of `CLAUDE.md` forbid Vietnamese identifiers, and
 * `CLAUDE.md` wins, so the same function is {@link ColoringMode.paint} and its
 * argument is a {@link PaintSubject}. Every string a person reads stays
 * Vietnamese, lower case and sentence style, as invariant A6 requires.
 */

import type { RuleSeverity } from '@/domain/rules/registry';
import type { LevelId, ReviewMetadata, RoomUsage, SquareMetres } from '@/domain/spatial/types';
import { formatArea } from '@/lib/format/measure';
import { formatPercent } from '@/lib/format/number';

import {
  createQuantileScale,
  MAX_SCALE_STEPS,
  SEQUENTIAL_RAMP,
  UNPAINTED_TOKEN,
  type ColorTokenName,
  type QuantileScale,
} from './scales';

/* -------------------------------------------------------------------------- */
/* What a mode is given.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One thing on screen that can be painted.
 *
 * The same flat shape describes a wall, a room and an opening, so a mixed view
 * paints through one function rather than one per kind. Every field is required
 * and nullable rather than optional: a wall has no floor area, and saying so
 * with `areaM2: null` is a fact the mode can act on, where an absent key would
 * be indistinguishable from a caller that forgot to set it.
 */
export interface PaintSubject {
  /** The prefixed entity code, for a caller keying its own results. */
  readonly id: string;
  /** The level this sits on; `null` for something building-wide. */
  readonly levelId: LevelId | null;
  /** Confidence, source and the reviewed flag, as the graph carries them. */
  readonly review: ReviewMetadata;
  /** What the room is for; `null` for anything that is not a room. */
  readonly usage: RoomUsage | null;
  /** Floor area; `null` for anything that does not enclose one. */
  readonly areaM2: SquareMetres | null;
  /** The worst rule this breaks; `null` when it breaks none. */
  readonly worstSeverity: RuleSeverity | null;
}

/**
 * The view a mode is built against.
 *
 * `subjects` is what is on screen — the quantity modes cut their bands against
 * exactly this list and nothing wider.
 */
export interface ColoringContext {
  /** The objects currently in view. */
  readonly subjects: readonly PaintSubject[];
  /**
   * The level stack, bottom floor first.
   *
   * Omit it and the stack is taken from the levels the subjects sit on, sorted
   * by code — which is the right order for `L-01`, `L-02`, `L-03` and is only a
   * guess for anything else, so a caller that knows the real stacking order
   * should pass it.
   */
  readonly levelIds?: readonly LevelId[];
}

/* -------------------------------------------------------------------------- */
/* What a mode is.                                                             */
/* -------------------------------------------------------------------------- */

/** The seven modes, in the order the mode picker lists them. */
export const COLORING_MODE_IDS = [
  'default',
  'roomUsage',
  'area',
  'aiConfidence',
  'reviewState',
  'violationSeverity',
  'level',
] as const;

/** One of the seven modes. */
export type ColoringModeId = (typeof COLORING_MODE_IDS)[number];

/** One step of a mode's legend. */
export interface ColoringBand {
  readonly token: ColorTokenName;
  /** Vietnamese, lower case, sentence style — a level code inside it stays upper. */
  readonly label: string;
}

/** A mode, already built against one view. */
export interface ColoringMode {
  readonly id: ColoringModeId;
  /** Vietnamese name for the mode picker. */
  readonly label: string;
  /**
   * The legend, in band order. At most {@link MAX_SCALE_STEPS} entries.
   *
   * These are the steps of the scale. {@link UNPAINTED_TOKEN} is not among them:
   * it is what a subject the mode cannot read is painted, which is the absence
   * of a reading rather than a step of the scale.
   */
  readonly bands: readonly ColoringBand[];
  /**
   * The quantile cut points for a quantity mode, ascending; empty for every
   * other mode. A legend showing numbers must show these.
   */
  readonly breaks: readonly number[];
  /** The token for one object. Pure — same object, same token, every time. */
  readonly paint: (subject: PaintSubject) => ColorTokenName;
}

/** What the mode picker calls each mode. */
export const COLORING_MODE_LABELS: Readonly<Record<ColoringModeId, string>> = {
  default: 'mặc định',
  roomUsage: 'theo công năng phòng',
  area: 'theo diện tích',
  aiConfidence: 'theo độ tin cậy AI',
  reviewState: 'theo trạng thái kiểm tra',
  violationSeverity: 'theo mức vi phạm',
  level: 'theo tầng',
};

/* -------------------------------------------------------------------------- */
/* The categorical vocabularies.                                               */
/* -------------------------------------------------------------------------- */

/**
 * The eight uses of the graph, grouped into five.
 *
 * The palette has one accent and three state colours, and none of them may be
 * spent on "this is a kitchen"; that leaves the five neutrals of
 * {@link SEQUENTIAL_RAMP}, so eight uses have to become five groups. The grouping
 * is the one a person reads a plan by — where you live, where you sleep, what
 * serves those, what you pass through — rather than an arbitrary partition, and
 * the neutrals run from dark for the rooms a plan is about to light for the
 * spaces between them.
 *
 * A complete `Record`, so adding a use to `RoomUsage` fails the build here
 * instead of quietly falling into `other`.
 */
type UsageGroup = 'living' | 'sleeping' | 'service' | 'circulation' | 'other';

const USAGE_GROUPS: Readonly<Record<RoomUsage, UsageGroup>> = {
  livingRoom: 'living',
  bedroom: 'sleeping',
  kitchen: 'service',
  bathroom: 'service',
  utility: 'service',
  corridor: 'circulation',
  stairwell: 'circulation',
  other: 'other',
};

/** The groups in legend order: the rooms a plan is about, then the rest. */
const USAGE_GROUP_ORDER: readonly UsageGroup[] = [
  'living',
  'sleeping',
  'service',
  'circulation',
  'other',
];

const USAGE_GROUP_TOKENS: Readonly<Record<UsageGroup, ColorTokenName>> = {
  living: '--wall-330',
  sleeping: '--wall-220',
  service: '--wall-110',
  circulation: '--wall-idle',
  other: '--bg-sunken',
};

const USAGE_GROUP_LABELS: Readonly<Record<UsageGroup, string>> = {
  living: 'sinh hoạt chung',
  sleeping: 'phòng ngủ',
  service: 'khu phụ trợ',
  circulation: 'lưu thông',
  other: 'khác',
};

/**
 * How far through review something is.
 *
 * Three states, and only the first earns the green. `drawnByPerson` and
 * `fromModel` are both unapproved, but they are not the same thing to a
 * reviewer — one is a colleague's line, the other is a guess — so they get
 * different weights of the same neutral rather than one shared colour.
 */
type ReviewStage = 'approved' | 'drawnByPerson' | 'fromModel';

const REVIEW_STAGE_ORDER: readonly ReviewStage[] = ['approved', 'drawnByPerson', 'fromModel'];

const REVIEW_STAGE_TOKENS: Readonly<Record<ReviewStage, ColorTokenName>> = {
  approved: '--state-verified',
  drawnByPerson: '--wall-220',
  fromModel: '--wall-idle',
};

const REVIEW_STAGE_LABELS: Readonly<Record<ReviewStage, string>> = {
  approved: 'đã duyệt',
  drawnByPerson: 'người vẽ, chưa duyệt',
  fromModel: 'AI đề xuất, chưa duyệt',
};

/**
 * How badly a broken rule reads on the model.
 *
 * A suggestion takes the weak form of the attention colour rather than the full
 * one: colouring every finding at full strength leaves a QC sheet with nothing
 * to draw the eye to. The verified green is absent on purpose — an object with
 * nothing wrong is not an object a person approved, so a clean model is neutral.
 */
const SEVERITY_TOKENS: Readonly<Record<RuleSeverity, ColorTokenName>> = {
  critical: '--state-violation',
  warning: '--state-attention',
  suggestion: '--state-attention-tint',
};

/**
 * What the interface calls each severity.
 *
 * The same three strings are `RULE_SEVERITY_LABELS` in `@/domain/rules/registry`.
 * A colouring module must not depend on the rule book to name a legend, so the
 * table is restated rather than imported; the test file compares the two, so the
 * copy cannot drift from the original.
 */
const SEVERITY_LABELS: Readonly<Record<RuleSeverity, string>> = {
  critical: 'nghiêm trọng',
  warning: 'cảnh báo',
  suggestion: 'gợi ý',
};

/** Severities worst first, matching the order the rule book lists them in. */
const SEVERITY_ORDER: readonly RuleSeverity[] = ['critical', 'warning', 'suggestion'];

/** An object breaking no rule. Neutral, and deliberately not the verified green. */
const NO_VIOLATION_TOKEN: ColorTokenName = '--wall-idle';
const NO_VIOLATION_LABEL = 'không có vi phạm';

/** The untinted model, which is what `default` paints everything. */
const UNTINTED_TOKEN: ColorTokenName = '--wall-idle';

/* -------------------------------------------------------------------------- */
/* Legends for the quantity modes.                                             */
/* -------------------------------------------------------------------------- */

/** What a band covers, written out: `"đến 12,50 m²"`, `"từ 45,00 m²"`. */
function rangeLabel(
  breaks: readonly number[],
  index: number,
  bandCount: number,
  write: (value: number) => string,
): string {
  if (bandCount <= 1) {
    return 'toàn bộ dữ liệu đang xem';
  }

  const lower = breaks[index - 1];
  const upper = breaks[index];

  if (lower === undefined) {
    return upper === undefined ? 'toàn bộ dữ liệu đang xem' : `đến ${write(upper)}`;
  }

  return upper === undefined ? `từ ${write(lower)}` : `${write(lower)} – ${write(upper)}`;
}

/** One legend entry per band of a quantity scale. */
function rangeBands(scale: QuantileScale, write: (value: number) => string): ColoringBand[] {
  const bands: ColoringBand[] = [];

  for (let index = 0; index < scale.bandCount; index += 1) {
    bands.push({
      token: scale.tokens[index] ?? UNPAINTED_TOKEN,
      label: rangeLabel(scale.breaks, index, scale.bandCount, write),
    });
  }

  return bands;
}

/** The readings a quantity mode cuts against: finite numbers only. */
function readingsOf(
  subjects: readonly PaintSubject[],
  read: (subject: PaintSubject) => number | null,
): number[] {
  const readings: number[] = [];

  for (const subject of subjects) {
    const value = read(subject);

    if (value !== null && Number.isFinite(value)) {
      readings.push(value);
    }
  }

  return readings;
}

/* -------------------------------------------------------------------------- */
/* The seven builders.                                                         */
/* -------------------------------------------------------------------------- */

/** Everything in one neutral: the model as it looks before a question is asked. */
function createDefaultMode(): ColoringMode {
  return {
    id: 'default',
    label: COLORING_MODE_LABELS.default,
    bands: [{ token: UNTINTED_TOKEN, label: 'mô hình chưa tô màu' }],
    breaks: [],
    paint: () => UNTINTED_TOKEN,
  };
}

/** By what the room is for. Anything that is not a room goes unpainted. */
function createRoomUsageMode(): ColoringMode {
  return {
    id: 'roomUsage',
    label: COLORING_MODE_LABELS.roomUsage,
    bands: USAGE_GROUP_ORDER.map((group) => ({
      token: USAGE_GROUP_TOKENS[group],
      label: USAGE_GROUP_LABELS[group],
    })),
    breaks: [],
    paint: (subject) =>
      subject.usage === null ? UNPAINTED_TOKEN : USAGE_GROUP_TOKENS[USAGE_GROUPS[subject.usage]],
  };
}

/**
 * By floor area, cut at the quantiles of the rooms in view.
 *
 * Ascending: the largest rooms take the darkest step, which is how a plan is
 * read — the hall should be the first thing the eye lands on.
 */
function createAreaMode(subjects: readonly PaintSubject[]): ColoringMode {
  const scale = createQuantileScale(
    readingsOf(subjects, (subject) => subject.areaM2),
    { direction: 'ascending' },
  );

  return {
    id: 'area',
    label: COLORING_MODE_LABELS.area,
    bands: rangeBands(scale, (value) => formatArea(value)),
    breaks: scale.breaks,
    paint: (subject) =>
      subject.areaM2 === null ? UNPAINTED_TOKEN : scale.tokenOf(subject.areaM2),
  };
}

/**
 * By how sure the pipeline was, cut at the quantiles of the scores in view.
 *
 * Descending: the *least* confident fifth takes the darkest step. A reviewer
 * opens this mode to find what to check, so what needs checking is what has to
 * be visible, and a mode that made the confident objects loudest would be
 * showing the reviewer the part of the model they can skip.
 *
 * No step of this scale is a state colour. A score of 1,0 is a dark neutral, not
 * the verified green: the pipeline being certain is not a person having looked.
 */
function createAiConfidenceMode(subjects: readonly PaintSubject[]): ColoringMode {
  const scale = createQuantileScale(
    readingsOf(subjects, (subject) => subject.review.confidence),
    { direction: 'descending' },
  );

  return {
    id: 'aiConfidence',
    label: COLORING_MODE_LABELS.aiConfidence,
    bands: rangeBands(scale, (value) => formatPercent(value, { fractionDigits: 0 })),
    breaks: scale.breaks,
    paint: (subject) => scale.tokenOf(subject.review.confidence),
  };
}

/** By how far through review something is. The only mode that spends the green. */
function createReviewStateMode(): ColoringMode {
  const stageOf = (subject: PaintSubject): ReviewStage => {
    if (subject.review.reviewed) {
      return 'approved';
    }

    return subject.review.source === 'human' ? 'drawnByPerson' : 'fromModel';
  };

  return {
    id: 'reviewState',
    label: COLORING_MODE_LABELS.reviewState,
    bands: REVIEW_STAGE_ORDER.map((stage) => ({
      token: REVIEW_STAGE_TOKENS[stage],
      label: REVIEW_STAGE_LABELS[stage],
    })),
    breaks: [],
    paint: (subject) => REVIEW_STAGE_TOKENS[stageOf(subject)],
  };
}

/** By the worst rule an object breaks. */
function createViolationSeverityMode(): ColoringMode {
  return {
    id: 'violationSeverity',
    label: COLORING_MODE_LABELS.violationSeverity,
    bands: [
      ...SEVERITY_ORDER.map((severity) => ({
        token: SEVERITY_TOKENS[severity],
        label: SEVERITY_LABELS[severity],
      })),
      { token: NO_VIOLATION_TOKEN, label: NO_VIOLATION_LABEL },
    ],
    breaks: [],
    paint: (subject) =>
      subject.worstSeverity === null ? NO_VIOLATION_TOKEN : SEVERITY_TOKENS[subject.worstSeverity],
  };
}

/** The levels the subjects sit on, in code order, when no stack was given. */
function inferLevelStack(subjects: readonly PaintSubject[]): LevelId[] {
  const seen = new Set<LevelId>();

  for (const subject of subjects) {
    if (subject.levelId !== null) {
      seen.add(subject.levelId);
    }
  }

  return [...seen].sort((first, second) => first.localeCompare(second));
}

/**
 * By position in the level stack, bottom light and top dark.
 *
 * The bands come from the stack, not from the objects: a building of four floors
 * gets four bands whichever floor happens to hold the most walls. Taller stacks
 * fold into five bands of neighbouring floors, so the mode keeps reading as
 * "how high up" rather than dissolving into a stripe per floor.
 */
function createLevelMode(subjects: readonly PaintSubject[], levelIds?: readonly LevelId[]): ColoringMode {
  const stack = levelIds !== undefined && levelIds.length > 0 ? levelIds : inferLevelStack(subjects);
  const bandCount = Math.min(Math.max(stack.length, 1), MAX_SCALE_STEPS);
  const tokens = SEQUENTIAL_RAMP.slice(0, bandCount);

  const rankOf = new Map<LevelId, number>();
  stack.forEach((levelId, index) => rankOf.set(levelId, index));

  const bandOfRank = (rank: number): number =>
    stack.length <= 1 ? 0 : Math.min(bandCount - 1, Math.floor((rank * bandCount) / stack.length));

  // Each band is labelled with the floors it actually covers, so a folded stack
  // says "L-05, L-06" rather than leaving a reader to work out the grouping.
  const covered: LevelId[][] = Array.from({ length: bandCount }, () => []);

  stack.forEach((levelId, index) => {
    covered[bandOfRank(index)]?.push(levelId);
  });

  const bands: ColoringBand[] =
    stack.length === 0
      ? []
      : tokens.map((token, index) => ({ token, label: (covered[index] ?? []).join(', ') }));

  return {
    id: 'level',
    label: COLORING_MODE_LABELS.level,
    bands,
    breaks: [],
    paint: (subject) => {
      const rank = subject.levelId === null ? undefined : rankOf.get(subject.levelId);

      return rank === undefined ? UNPAINTED_TOKEN : (tokens[bandOfRank(rank)] ?? UNPAINTED_TOKEN);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* One way in.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build one mode against the objects currently in view.
 *
 * Build it again with a different view and the quantity modes come back with
 * different boundaries — that is the point, and it is why a mode is built rather
 * than imported. Building is cheap: one sort of the readings. Painting after
 * that is a lookup, so a caller may call {@link ColoringMode.paint} once per
 * object per frame.
 *
 * @example
 * const mode = createColoringMode('area', { subjects });
 * mode.paint(subjects[0]);   // '--wall-330'
 * mode.breaks;               // [8.4, 12.1, 18.7, 31.2] — this view's quantiles
 */
export function createColoringMode(id: ColoringModeId, context: ColoringContext): ColoringMode {
  switch (id) {
    case 'default':
      return createDefaultMode();
    case 'roomUsage':
      return createRoomUsageMode();
    case 'area':
      return createAreaMode(context.subjects);
    case 'aiConfidence':
      return createAiConfidenceMode(context.subjects);
    case 'reviewState':
      return createReviewStateMode();
    case 'violationSeverity':
      return createViolationSeverityMode();
    case 'level':
      return createLevelMode(context.subjects, context.levelIds);
  }
}

/** All seven modes against one view, in picker order. */
export function createColoringModes(context: ColoringContext): readonly ColoringMode[] {
  return COLORING_MODE_IDS.map((id) => createColoringMode(id, context));
}
