/**
 * The fields a person edits a threshold in — label, unit, band, step.
 *
 * Split out of `config.ts` for one measured reason. `runner.ts` imports
 * *values* from `config.ts`, so `config.ts` is in the static import graph of
 * every screen that runs a rule pass, including the 3D viewer, which never
 * shows a settings field in its life. Twenty-six Vietnamese labels, twenty-six
 * bands and the sentence builder that quotes them were riding into those
 * bundles with nothing to read them. Only the rule settings screen imports this
 * module, and it is lazily routed, so the cost lands where the fields do.
 *
 * The split is along "does the engine read it?", which is the only line that
 * survives contact with a new rule: a check measures against a *number*, and
 * `min`, `max`, `step` and `label` are decisions about the field a person types
 * that number into.
 *
 * **One source of truth per number.** Every `defaultValue` here is read back
 * out of {@link DEFAULT_RULE_THRESHOLDS}, which holds the running constants —
 * so a spec cannot claim a default the rule does not actually use, and a key
 * typed wrong here fails loudly at import rather than quietly offering to
 * "restore" a value that was never shipped.
 *
 * `min`, `max`, `step` and `label` are this module's own decisions, and each
 * carries its reason next to it. The bands are chosen the same way throughout:
 * the low end is where the check stops being able to say anything — usually
 * "off", or the noise floor of a traced drawing — and the high end is where it
 * starts firing on ordinary correct work. A band wider than that is not more
 * freedom, it is a typo nobody catches; `600` typed for `60` has to be refused
 * at the field, and `min`/`max` are what refuses it.
 */

import {
  DEFAULT_RULE_THRESHOLDS,
  GENERAL_THRESHOLD_CODE,
  type RuleThresholdSpec,
  type RuleThresholdUnit,
  type ThresholdValidation,
} from './config';
import { MIN_ROOM_AREA_M2, ROOM_USAGE_LABELS, type RuleCode } from './registry';
import type { RoomUsage } from '../spatial/types';
import { formatNumber } from '../../lib/format/number';

/**
 * The shipped value of one threshold, or a loud failure.
 *
 * A spec whose key is not in {@link DEFAULT_RULE_THRESHOLDS} has no default at
 * all, and inventing one — `0`, say — would put a number on screen that no rule
 * has ever measured against. Throwing at module load turns that into a test
 * failure on the first render instead of a wrong "khôi phục mặc định".
 */
function shipped(key: string): number {
  const value = DEFAULT_RULE_THRESHOLDS[key];

  if (value === undefined) {
    throw new Error(`thresholdSpecs: '${key}' is not a key of DEFAULT_RULE_THRESHOLDS.`);
  }

  return value;
}

/**
 * The eight minimum floor areas, one per room use.
 *
 * Built rather than typed out because the eight differ in exactly two things —
 * the use and its shipped minimum — and eight hand-written copies of the same
 * band is eight chances to mistype one of them.
 *
 * The band is the same for all eight. `0` switches the check off for that use,
 * which is what the four shipped zeros already mean: the rule skips a use whose
 * minimum is not positive, so a corridor is never measured against `0`. 60 m² is
 * larger than any standard writes a *minimum* at, so the ceiling never gets in
 * the way of a real project while still refusing a `600` typed for `60`. Steps
 * of 0,5 m² because minimum areas are written in halves — 2,5 · 5 · 9 · 12.
 */
function roomAreaSpecs(): readonly RuleThresholdSpec[] {
  const uses = Object.keys(MIN_ROOM_AREA_M2) as readonly RoomUsage[];

  return uses.map((usage) => ({
    key: `room.minArea.${usage}`,
    // Filed under the rule that is actually switched on. `ROOM-MIN-AREA` reads
    // the same eight numbers but is superseded and off by default, so hanging
    // the fields off it would put them on a row nobody can reach.
    ruleCode: 'ROOM-AREA-BELOW-MINIMUM',
    label: `diện tích tối thiểu của ${ROOM_USAGE_LABELS[usage]}`,
    unit: 'm2' as const,
    min: 0,
    max: 60,
    step: 0.5,
    defaultValue: shipped(`room.minArea.${usage}`),
    isGeneral: false,
  }));
}

/** Every number a project may tune, in the order the screen lists them. */
export const RULE_THRESHOLD_SPECS: readonly RuleThresholdSpec[] = Object.freeze([
  /* -- Shared geometric tolerances --------------------------------------- */
  {
    key: 'general.parallelAngleDeg',
    ruleCode: GENERAL_THRESHOLD_CODE,
    label: 'góc lệch tối đa còn coi là hai đường song song',
    unit: 'do',
    // 0° means "only lines that are exactly parallel count", which a CAD-clean
    // export can honestly ask for. Past 30° two runs point in visibly different
    // directions and the crossing test, not the overlap test, is the one that
    // applies — so a wider band would only let a project defeat the rule it is
    // configuring. One degree is the finest a traced angle is worth stating.
    min: 0,
    max: 30,
    step: 1,
    defaultValue: shipped('general.parallelAngleDeg'),
    isGeneral: true,
  },
  {
    key: 'general.jointToleranceMm',
    ruleCode: GENERAL_THRESHOLD_CODE,
    label: 'khoảng hở tối đa còn coi là hai tường đã nối vào nhau',
    unit: 'mm',
    // 0 demands ends that coincide exactly. 500 mm is half a metre, wider than
    // any drafting slop, and past it walls that genuinely stop short of one
    // another get welded together and the dangling-end rule reports nothing at
    // all. Steps of 5 mm, because a drawing tolerance is stated in fives.
    min: 0,
    max: 500,
    step: 5,
    defaultValue: shipped('general.jointToleranceMm'),
    isGeneral: true,
  },
  /* -- WALL-THICKNESS ----------------------------------------------------- */
  {
    key: 'wall.minThicknessMm',
    ruleCode: 'WALL-THICKNESS',
    label: 'bề dày tường tối thiểu',
    unit: 'mm',
    // 30 mm is a single plasterboard leaf, the thinnest thing anybody draws and
    // still calls a wall. 200 mm is already loadbearing masonry, so a minimum
    // above it would flag every partition in the plan.
    min: 30,
    max: 200,
    step: 5,
    defaultValue: shipped('wall.minThicknessMm'),
    isGeneral: false,
  },
  {
    key: 'wall.maxThicknessMm',
    ruleCode: 'WALL-THICKNESS',
    label: 'bề dày tường tối đa',
    unit: 'mm',
    // 200 mm at the low end, so this ceiling can never be dragged under the
    // floor its sibling sets for an ordinary project. 1000 mm is a metre-thick
    // basement retaining wall; a line thicker than that is two walls traced as
    // one, which is the defect this rule exists to catch.
    min: 200,
    max: 1000,
    step: 10,
    defaultValue: shipped('wall.maxThicknessMm'),
    isGeneral: false,
  },

  /* -- WALL-LENGTH -------------------------------------------------------- */
  {
    key: 'wall.minLengthMm',
    ruleCode: 'WALL-LENGTH',
    label: 'chiều dài tường tối thiểu',
    unit: 'mm',
    // 10 mm is the noise floor of a traced drawing. Above a metre the rule
    // starts condemning real work: a 900 mm jamb return beside a door is a wall.
    min: 10,
    max: 1000,
    step: 10,
    defaultValue: shipped('wall.minLengthMm'),
    isGeneral: false,
  },

  /* -- DOOR-WIDTH --------------------------------------------------------- */
  {
    key: 'door.minWidthMm',
    ruleCode: 'DOOR-WIDTH',
    label: 'bề rộng cửa đi tối thiểu',
    unit: 'mm',
    // 600 mm is the narrowest cupboard leaf anybody draws as a door. 1200 mm is
    // a double-leaf entrance, and a minimum above that flags every internal
    // door in a dwelling. Steps of 10 mm, the granularity of a door schedule.
    min: 600,
    max: 1200,
    step: 10,
    defaultValue: shipped('door.minWidthMm'),
    isGeneral: false,
  },

  /* -- ROOM-AREA-BELOW-MINIMUM -------------------------------------------- */
  ...roomAreaSpecs(),

  /* -- WALL-OVERLAP ------------------------------------------------------- */
  {
    key: 'wallOverlap.minOverlapMm',
    ruleCode: 'WALL-OVERLAP',
    label: 'đoạn chồng nhau tối thiểu để tính là hai tường chồng lên nhau',
    unit: 'mm',
    // Below 1 mm every pair of touching walls is an overlap and the report is
    // useless. At 500 mm a genuinely duplicated half-metre run stops being
    // reported, which is exactly the defect this rule was written for.
    min: 1,
    max: 500,
    step: 1,
    defaultValue: shipped('wallOverlap.minOverlapMm'),
    isGeneral: false,
  },

  /* -- ROOM-NOT-CLOSED ---------------------------------------------------- */
  {
    key: 'roomClosure.lateralToleranceMm',
    ruleCode: 'ROOM-NOT-CLOSED',
    label: 'độ lệch ngang tối đa để tường còn khép được cạnh phòng',
    unit: 'mm',
    // Measured sideways from the wall face to the room edge, so it is the same
    // drafting-slop band as the joint tolerance: 0 for a CAD-clean model, half
    // a metre before a wall in the next room starts closing this one.
    min: 0,
    max: 500,
    step: 5,
    defaultValue: shipped('roomClosure.lateralToleranceMm'),
    isGeneral: false,
  },
  {
    key: 'roomClosure.maxUncoveredEdgeMm',
    ruleCode: 'ROOM-NOT-CLOSED',
    label: 'đoạn đường bao dài nhất được phép không có tường',
    unit: 'mm',
    // 0 demands an outline walled end to end. 2000 mm is a wide opening; allow
    // more and an open-plan edge with no wall at all stops being reported.
    min: 0,
    max: 2000,
    step: 10,
    defaultValue: shipped('roomClosure.maxUncoveredEdgeMm'),
    isGeneral: false,
  },

  /* -- WALL-UNSUPPORTED --------------------------------------------------- */
  {
    key: 'wallSupport.minSupportShare',
    ruleCode: 'WALL-UNSUPPORTED',
    label: 'phần tường chịu lực phải có điểm tựa ở tầng dưới',
    unit: 'tile',
    // A share of the wall's length, stored as the share the rule measures: the
    // viewmodel is what turns 0,8 into "80 %" for the field.
    //
    // The band starts at half rather than at nothing. Below 0,5 the majority of
    // a loadbearing wall is hanging over thin air and "supported" has stopped
    // meaning anything, so a project setting it there has switched the rule off
    // without saying so — and switching a rule off is what the toggle is for.
    // 1 demands a wall supported along its whole run. Twentieths, because a
    // support share finer than five hundredths is not a decision anybody can
    // defend on a drawing.
    min: 0.5,
    max: 1,
    step: 0.05,
    defaultValue: shipped('wallSupport.minSupportShare'),
    isGeneral: false,
  },

  /* -- STAIR-ALIGNMENT ---------------------------------------------------- */
  {
    key: 'stair.alignmentToleranceMm',
    ruleCode: 'STAIR-ALIGNMENT',
    label: 'độ lệch tối đa giữa hai vế thang chồng tầng',
    unit: 'mm',
    // 0 demands stair cores that line up exactly, which a modelled building can
    // meet. A metre out and the shaft above no longer lands on the one below,
    // so a tolerance past that would wave a real misalignment through.
    min: 0,
    max: 1000,
    step: 10,
    defaultValue: shipped('stair.alignmentToleranceMm'),
    isGeneral: false,
  },

  /* -- CORRIDOR-WIDTH ----------------------------------------------------- */
  {
    key: 'corridor.minClearWidthMm',
    ruleCode: 'CORRIDOR-WIDTH',
    label: 'bề rộng thông thuỷ tối thiểu của hành lang',
    unit: 'mm',
    // 600 mm is one person turned sideways: below that nothing is an escape
    // route. 3 m is a lobby, and a minimum that high flags every corridor in a
    // house. Steps of 50 mm, the granularity clear widths are specified at.
    min: 600,
    max: 3000,
    step: 50,
    defaultValue: shipped('corridor.minClearWidthMm'),
    isGeneral: false,
  },
  {
    key: 'stairwell.minClearWidthMm',
    ruleCode: 'CORRIDOR-WIDTH',
    label: 'bề rộng thông thuỷ tối thiểu của buồng thang',
    unit: 'mm',
    // Same band as the corridor: it is the same measurement on the same escape
    // route, and a project that widens one and forgets the other has built a
    // bottleneck exactly where everybody is heading.
    min: 600,
    max: 3000,
    step: 50,
    defaultValue: shipped('stairwell.minClearWidthMm'),
    isGeneral: false,
  },

  /* -- ESCAPE-DISTANCE ---------------------------------------------------- */
  {
    key: 'escape.openingOnOutlineToleranceMm',
    ruleCode: 'ESCAPE-DISTANCE',
    label: 'độ lệch tối đa để lỗ mở còn được tính là của phòng',
    unit: 'mm',
    // Which room a door belongs to, for the door graph the escape search walks.
    // A long party wall is named by every room along it, so a door on it has to
    // be placed by where it actually is. 0 demands the door centre land exactly
    // on the outline, which no traced plan manages; a metre and one door starts
    // counting for the room on the far side of the wall too, which shortens an
    // escape route that was never there.
    min: 0,
    max: 1000,
    step: 10,
    defaultValue: shipped('escape.openingOnOutlineToleranceMm'),
    isGeneral: false,
  },
  {
    key: 'escape.maxDistanceMm',
    ruleCode: 'ESCAPE-DISTANCE',
    label: 'quãng đường thoát nạn tối đa',
    unit: 'mm',
    // 5 m is stricter than any standard writes and is the floor at which the
    // number still means something. 100 m is past the longest travel distance a
    // sprinklered building is ever allowed. Steps of a metre, since travel
    // distances are quoted in metres.
    min: 5000,
    max: 100000,
    step: 1000,
    defaultValue: shipped('escape.maxDistanceMm'),
    isGeneral: false,
  },

  /* -- DOOR-BLOCKS-PATH --------------------------------------------------- */
  {
    key: 'door.minClearPassageMm',
    ruleCode: 'DOOR-BLOCKS-PATH',
    label: 'khoảng trống tối thiểu còn lại khi cánh cửa mở hết',
    unit: 'mm',
    // 500 mm is the narrowest gap a person gets through sideways. Past 1,5 m the
    // rule fires on every ordinary hallway door, which is noise, not a finding.
    min: 500,
    max: 1500,
    step: 10,
    defaultValue: shipped('door.minClearPassageMm'),
    isGeneral: false,
  },

  /* -- FURNITURE-CLASH ---------------------------------------------------- */
  {
    key: 'furniture.minClashMm',
    ruleCode: 'FURNITURE-CLASH',
    label: 'độ chồng lấn tối thiểu để tính là đồ đạc va nhau',
    unit: 'mm',
    // 1 mm is the noise floor of traced furniture outlines; below it every chair
    // against a wall is a clash. At 200 mm a chair pushed a hand's width into
    // the wall stops counting as one.
    min: 1,
    max: 200,
    step: 1,
    defaultValue: shipped('furniture.minClashMm'),
    isGeneral: false,
  },

  /* -- FIXTURE-OFF-WALL --------------------------------------------------- */
  {
    key: 'fixture.wallHuggingToleranceMm',
    ruleCode: 'FIXTURE-OFF-WALL',
    label: 'khoảng cách tối đa để thiết bị còn coi là áp sát tường',
    unit: 'mm',
    // 0 demands the fixture touch the wall face exactly, which a model can meet
    // and a tracing cannot. Half a metre out, a basin is standing in the room
    // rather than against the wall, so the band stops there.
    min: 0,
    max: 500,
    step: 5,
    defaultValue: shipped('fixture.wallHuggingToleranceMm'),
    isGeneral: false,
  },
]);

/** Every spec by key, for the lookups validation and the screen need. */
const SPEC_BY_KEY: ReadonlyMap<string, RuleThresholdSpec> = new Map(
  RULE_THRESHOLD_SPECS.map((spec) => [spec.key, spec]),
);

/** The thresholds filed under one rule code, in screen order. */
export function thresholdSpecsFor(code: RuleCode): readonly RuleThresholdSpec[] {
  return RULE_THRESHOLD_SPECS.filter((spec) => spec.ruleCode === code);
}

/** The spec for one key, or `null` for a key this build does not know. */
export function thresholdSpecByKey(key: string): RuleThresholdSpec | null {
  return SPEC_BY_KEY.get(key) ?? null;
}

/**
 * The suffix a person reads after the number, e.g. `mm`, `m²`, `°`, `%`.
 *
 * A bare ratio has no suffix at this layer, and gets the empty string rather
 * than a made-up one: `0,8` followed by `%` would be wrong by a factor of a
 * hundred, and the conversion that makes it right belongs to the viewmodel.
 */
export function thresholdUnitText(unit: RuleThresholdUnit): string {
  switch (unit) {
    case 'mm':
      return 'mm';
    case 'm2':
      return 'm²';
    case 'do':
      return '°';
    case 'phantram':
      return '%';
    case 'tile':
      return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Is this number one the rule can run with?
 *
 * The failure message always names the band, because "giá trị không hợp lệ"
 * tells a person they are wrong and not what would be right — and a field that
 * refuses a number without saying which numbers it wants is a dead end. The
 * sentence is built from the spec, so it cannot drift out of step with the
 * `min`/`max` the field enforces.
 *
 * Only the band and finiteness are checked. Landing off `step` is the stepper's
 * business: a number typed between two steps is a number the rule can measure
 * with perfectly well, and refusing it would be pedantry with a red border.
 */
export function validateThreshold(spec: RuleThresholdSpec, raw: number): ThresholdValidation {
  if (Number.isFinite(raw) && raw >= spec.min && raw <= spec.max) {
    return { ok: true, value: raw };
  }

  return { ok: false, message: outOfRangeMessage(spec) };
}

/** `'bề dày tường tối thiểu nhận giá trị từ 30 đến 200 mm.'` */
function outOfRangeMessage(spec: RuleThresholdSpec): string {
  const low = formatNumber(spec.min, { maxFractionDigits: 2 });
  const high = formatNumber(spec.max, { maxFractionDigits: 2 });
  const unit = thresholdUnitText(spec.unit);
  // A ratio has no suffix, and a sentence must not end on a stranded space.
  const suffix = unit === '' ? '' : ` ${unit}`;

  return `${spec.label} nhận giá trị từ ${low} đến ${high}${suffix}.`;
}
