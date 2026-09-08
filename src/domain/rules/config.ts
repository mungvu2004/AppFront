/**
 * What a project is allowed to change about the rule book, and what it is not.
 *
 * The rule book itself — `registry.ts` and the three groups next door — is
 * fixed code: twenty-five checks, each measuring against a hard-coded number.
 * That is right for a default and wrong for a project, because a warehouse and
 * a flat do not agree about how narrow a corridor may be. This module is the
 * one place a project is allowed to disagree, and the vocabulary it disagrees
 * in.
 *
 * Three decisions shape everything below.
 *
 * **A configuration is data, not a call.** Nothing here touches
 * `registry.setEnabled`, which edits a process-wide singleton that cannot be
 * undone, cannot be autosaved, and shows two screens two different rule books.
 * Every function here takes a `RuleConfig` and returns a *new* one, so the store
 * can `commit(patch, label)` it and A8 (undo) and A7 (autosave) come for free.
 * `version` rises on every change, which is what lets the violation cache key on
 * `(spatial, config.version)` and actually recompute when a threshold moves.
 *
 * **A configuration says only what differs.** `overrides` holds a rule code only
 * when that rule has been touched, and a threshold key only when its value is
 * not the shipped default. Empty `overrides` therefore *means* "the defaults"
 * rather than merely coinciding with them, which is what makes
 * {@link isDefaultConfig} a lookup rather than a comparison against a rule book
 * this module would otherwise have to keep a second copy of.
 *
 * **Every `defaultValue` is the running constant, not a copy of it.** The specs
 * below import `MIN_WALL_THICKNESS_MM`, `PARALLEL_ANGLE_DEG` and the rest from
 * the modules that measure against them. A number retyped here would drift the
 * first time somebody tuned a rule, and the screen would then offer to "restore
 * defaults" that had never been the defaults. `min`, `max`, `step` and `label`
 * are this module's own decisions, and each carries its reason next to it.
 */

import {
  MAX_WALL_THICKNESS_MM,
  MIN_DOOR_WIDTH_MM,
  MIN_ROOM_AREA_M2,
  MIN_WALL_LENGTH_MM,
  MIN_WALL_THICKNESS_MM,
  ROOM_USAGE_LABELS,
  type Rule,
  type RuleCode,
  type RuleGroup,
  type RuleRegistry,
  type RuleSeverity,
  type RuleThresholds,
} from './registry';
import {
  COVERAGE_LATERAL_TOLERANCE_MM,
  JOINT_TOLERANCE_MM,
  MAX_UNCOVERED_EDGE_MM,
  MIN_SUPPORT_SHARE,
  MIN_WALL_OVERLAP_MM,
  PARALLEL_ANGLE_DEG,
  STAIR_ALIGNMENT_TOLERANCE_MM,
} from './geometry';
import {
  MAX_ESCAPE_DISTANCE_MM,
  MIN_CLASH_MM,
  MIN_CLEAR_PASSAGE_MM,
  OPENING_ON_OUTLINE_TOLERANCE_MM,
  USAGE_REQUIREMENTS,
} from './function';
import { WALL_HUGGING_TOLERANCE_MM } from './fitout';
import { ALL_RULES } from './defaults';
import type { RoomUsage } from '../spatial/types';
import { formatNumber } from '../../lib/format/number';

export type { RuleThresholds } from './registry';

/* -------------------------------------------------------------------------- */
/* One adjustable number.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What a threshold is measured in.
 *
 * ASCII names rather than the symbols themselves, so the value can be switched
 * on and stored without a mojibake risk; {@link thresholdUnitText} turns each
 * into the suffix a person reads in the field.
 */
export type RuleThresholdUnit = 'mm' | 'm2' | 'do' | 'phantram';

/** One number a project may change, and the band it may change it inside. */
export interface RuleThresholdSpec {
  /**
   * Stable identifier, unique across the whole book.
   *
   * Globally unique rather than unique per rule, for two reasons: a tolerance
   * several checks read has to be one number wherever it is read, and the
   * screen changes a shared tolerance through `onChangeGeneralThreshold(key,
   * value)`, which carries no rule code at all.
   */
  readonly key: string;
  /**
   * The rule this threshold is filed under on screen.
   *
   * For a shared tolerance that is {@link GENERAL_THRESHOLD_CODE} rather than
   * any one of the rules that read it, so the "general thresholds" card owns it
   * and no rule row claims a number its neighbours also obey.
   */
  readonly ruleCode: RuleCode;
  /** Vietnamese, lower case, sentence style (A6). */
  readonly label: string;
  readonly unit: RuleThresholdUnit;
  /** Smallest accepted value. */
  readonly min: number;
  /** Largest accepted value. */
  readonly max: number;
  /** How far one press of the stepper moves the value. */
  readonly step: number;
  /** The constant the rule measures against today. Never a retyped copy. */
  readonly defaultValue: number;
  /** `true` ⇒ shown on the "general thresholds" card instead of on a rule row. */
  readonly isGeneral: boolean;
}

/**
 * The pseudo rule code the shared geometric tolerances are filed under.
 *
 * `PARALLEL_ANGLE_DEG` is read by three rules and `JOINT_TOLERANCE_MM` by two,
 * so neither belongs to a rule row: changing one from inside `WALL-OVERLAP`
 * would silently move `ROOM-NOT-CLOSED` too, and the row would be lying about
 * its own scope. They are stored against this code instead — which is what
 * `setRuleThreshold(config, GENERAL_THRESHOLD_CODE, key, value)` writes and what
 * the screen's general card reads.
 *
 * Deliberately not a real rule: `registry.get(GENERAL_THRESHOLD_CODE)` is
 * `null`, and no pass ever plans a task for it.
 */
export const GENERAL_THRESHOLD_CODE: RuleCode = 'GENERAL';

/* -------------------------------------------------------------------------- */
/* The thresholds themselves.                                                  */
/* -------------------------------------------------------------------------- */

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
    defaultValue: MIN_ROOM_AREA_M2[usage],
    isGeneral: false,
  }));
}

/**
 * Every number a project may tune, in the order the screen lists them.
 *
 * The bands are chosen the same way throughout: the low end is where the check
 * stops being able to say anything — usually "off", or the noise floor of a
 * traced drawing — and the high end is where it starts firing on ordinary
 * correct work. A band wider than that is not more freedom, it is a typo nobody
 * catches; `600` typed for `60` has to be refused at the field, and `min`/`max`
 * are what refuses it.
 */
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
    defaultValue: PARALLEL_ANGLE_DEG,
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
    defaultValue: JOINT_TOLERANCE_MM,
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
    defaultValue: MIN_WALL_THICKNESS_MM,
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
    defaultValue: MAX_WALL_THICKNESS_MM,
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
    defaultValue: MIN_WALL_LENGTH_MM,
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
    defaultValue: MIN_DOOR_WIDTH_MM,
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
    defaultValue: MIN_WALL_OVERLAP_MM,
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
    defaultValue: COVERAGE_LATERAL_TOLERANCE_MM,
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
    defaultValue: MAX_UNCOVERED_EDGE_MM,
    isGeneral: false,
  },

  /* -- WALL-UNSUPPORTED --------------------------------------------------- */
  {
    key: 'wallSupport.minSupportShare',
    ruleCode: 'WALL-UNSUPPORTED',
    label: 'phần tường chịu lực phải có điểm tựa ở tầng dưới',
    unit: 'phantram',
    // The rule measures a *share* of the wall's length, and `defaultValue` is
    // the constant it measures with, so the band runs 0 to 1 rather than 0 to
    // 100 — restating the shipped 0,8 as 80 would break the one hard rule these
    // specs have. 0 switches the check off; 1 demands a wall supported along its
    // whole run. Twentieths, because a support share finer than five hundredths
    // is not a decision anybody can defend on a drawing.
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: MIN_SUPPORT_SHARE,
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
    defaultValue: STAIR_ALIGNMENT_TOLERANCE_MM,
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
    defaultValue: USAGE_REQUIREMENTS.corridor.minClearWidthMm,
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
    defaultValue: USAGE_REQUIREMENTS.stairwell.minClearWidthMm,
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
    defaultValue: OPENING_ON_OUTLINE_TOLERANCE_MM,
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
    defaultValue: MAX_ESCAPE_DISTANCE_MM,
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
    defaultValue: MIN_CLEAR_PASSAGE_MM,
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
    defaultValue: MIN_CLASH_MM,
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
    defaultValue: WALL_HUGGING_TOLERANCE_MM,
    isGeneral: false,
  },
]);

/** Every spec by key, for the lookups validation and the setters need. */
const SPEC_BY_KEY: ReadonlyMap<string, RuleThresholdSpec> = new Map(
  RULE_THRESHOLD_SPECS.map((spec) => [spec.key, spec]),
);

/**
 * Every threshold at its shipped value.
 *
 * One frozen object, shared by every rule that has no override of its own, so
 * an unconfigured pass allocates nothing per rule and `resolveRules` can hand
 * the same reference to all twenty-five.
 */
export const DEFAULT_RULE_THRESHOLDS: RuleThresholds = Object.freeze(
  Object.fromEntries(RULE_THRESHOLD_SPECS.map((spec) => [spec.key, spec.defaultValue])),
);

/** The thresholds filed under one rule code, in screen order. */
export function thresholdSpecsFor(code: RuleCode): readonly RuleThresholdSpec[] {
  return RULE_THRESHOLD_SPECS.filter((spec) => spec.ruleCode === code);
}

/** The spec for one key, or `null` for a key this build does not know. */
export function thresholdSpecByKey(key: string): RuleThresholdSpec | null {
  return SPEC_BY_KEY.get(key) ?? null;
}

/** The suffix a person reads in the field, e.g. `mm`, `m²`, `°`, `%`. */
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
  }
}

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

/** Either a value the rule can run with, or a sentence saying what would be. */
export type ThresholdValidation =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

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

  return `${spec.label} nhận giá trị từ ${low} đến ${high} ${thresholdUnitText(spec.unit)}.`;
}

/* -------------------------------------------------------------------------- */
/* The configuration.                                                          */
/* -------------------------------------------------------------------------- */

/** What one project changed about one rule. Absent fields mean "as shipped". */
export interface RuleOverride {
  readonly enabled?: boolean;
  readonly severity?: RuleSeverity;
  readonly thresholds?: Readonly<Record<string, number>>;
}

/** Everything one project changed about the rule book. */
export interface RuleConfig {
  readonly overrides: Readonly<Record<RuleCode, RuleOverride>>;
  /**
   * Rises on every change.
   *
   * The violation cache keys on `(spatial, version)`: without a number that
   * moves, editing a threshold and re-reading the count gives the same answer
   * twice and the screen quietly lies about what it just did.
   */
  readonly version: number;
}

/** The rule book exactly as it ships. Version 0 always means this. */
export const EMPTY_RULE_CONFIG: RuleConfig = Object.freeze({
  overrides: Object.freeze({}),
  version: 0,
});

/**
 * Does this override actually change anything?
 *
 * A threshold set back to its shipped value is not a change, so it does not
 * count — which is what lets a person undo their way back to "default" by
 * typing rather than only by pressing restore. `enabled` and `severity` are
 * counted whenever they are present at all: telling default from non-default
 * for those needs the rule book, and a config is data that has to be readable
 * without one. The setters keep this honest by pruning as they write.
 */
function isEmptyOverride(override: RuleOverride | undefined): boolean {
  if (override === undefined) {
    return true;
  }

  if (override.enabled !== undefined || override.severity !== undefined) {
    return false;
  }

  return Object.entries(override.thresholds ?? {}).every(
    ([key, value]) => SPEC_BY_KEY.get(key)?.defaultValue === value,
  );
}

/** Is the rule book still exactly as it ships? */
export function isDefaultConfig(config: RuleConfig): boolean {
  return Object.values(config.overrides).every(isEmptyOverride);
}

/* -------------------------------------------------------------------------- */
/* Resolving a configuration against a rule book.                              */
/* -------------------------------------------------------------------------- */

/** One rule with the project's decisions already applied. */
export interface ResolvedRule {
  readonly rule: Rule;
  readonly enabled: boolean;
  readonly severity: RuleSeverity;
  /** Every threshold in the book, at the value this rule should read. */
  readonly thresholds: RuleThresholds;
  /** Is this rule untouched — same switch, same severity, same numbers? */
  readonly isDefault: boolean;
}

/**
 * Every rule in the book, with the project's changes folded in.
 *
 * Three things about the threshold map each rule gets.
 *
 * It holds **every** key, not only the ones filed under this rule, because a
 * rule reads whatever it reads: `DOOR-BLOCKS-PATH` measures a corridor's clear
 * width, which is filed under `CORRIDOR-WIDTH`. Handing every rule the whole
 * book costs one shared frozen object and removes a class of bug where a check
 * silently falls back to its hard-coded constant.
 *
 * The shared tolerances are layered **under** the rule's own, so a rule that
 * files a key of its own always wins for that key — there is no pair of keys
 * where that matters today, and the order is fixed now so it cannot become a
 * question later.
 *
 * `registry.isEnabled` is the reference for "as shipped", which is right
 * precisely because nothing in this design calls `registry.setEnabled`: the
 * registry stays at its shipped state and the config carries every deviation.
 */
export function resolveRules(registry: RuleRegistry, config: RuleConfig): readonly ResolvedRule[] {
  const general = config.overrides[GENERAL_THRESHOLD_CODE]?.thresholds;

  return registry.list().map((rule) => {
    const override = config.overrides[rule.code];
    const own = override?.thresholds;
    const thresholds: RuleThresholds =
      general === undefined && own === undefined
        ? DEFAULT_RULE_THRESHOLDS
        : Object.freeze({ ...DEFAULT_RULE_THRESHOLDS, ...general, ...own });

    return {
      rule,
      enabled: override?.enabled ?? registry.isEnabled(rule.code),
      severity: override?.severity ?? rule.severity,
      thresholds,
      isDefault: isEmptyOverride(override),
    };
  });
}

/** The threshold map for every rule, by code — what a pass hands each check. */
export function resolveThresholds(
  registry: RuleRegistry,
  config: RuleConfig,
): Readonly<Record<RuleCode, RuleThresholds>> {
  return Object.fromEntries(
    resolveRules(registry, config).map((resolved) => [resolved.rule.code, resolved.thresholds]),
  );
}

/* -------------------------------------------------------------------------- */
/* Writing a configuration.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A new config with one rule's override replaced, and the version moved on.
 *
 * The version rises on every write, even one that lands on the value already
 * there. A write the user made is a write the cache has to notice, and a
 * "nothing changed" shortcut here is how a screen ends up showing a stale count
 * after a threshold was nudged and nudged back.
 */
function withOverride(config: RuleConfig, code: RuleCode, next: RuleOverride): RuleConfig {
  const overrides: Record<RuleCode, RuleOverride> = { ...config.overrides };

  if (isEmptyOverride(next)) {
    // Prune rather than store an empty entry, so `isDefaultConfig` stays a
    // lookup and two configs meaning the same thing look the same.
    delete overrides[code];
  } else {
    overrides[code] = next;
  }

  return { overrides: Object.freeze(overrides), version: config.version + 1 };
}

/** Switch one rule on or off. */
export function setRuleEnabled(config: RuleConfig, code: RuleCode, enabled: boolean): RuleConfig {
  return withOverride(config, code, { ...config.overrides[code], enabled });
}

/** Move one rule to another of the three severities. */
export function setRuleSeverity(
  config: RuleConfig,
  code: RuleCode,
  severity: RuleSeverity,
): RuleConfig {
  return withOverride(config, code, { ...config.overrides[code], severity });
}

/**
 * Set one threshold on one rule.
 *
 * A value equal to the shipped default drops the key instead of storing it, so
 * typing a number back to where it started really does return the config to
 * default rather than leaving an invisible entry that keeps the "restore
 * defaults" footer on screen forever.
 *
 * The value is stored as given. Clamping belongs to {@link validateThreshold} at
 * the field, where there is somewhere to say why — silently rounding a number
 * the user typed is the same lie in a quieter voice.
 */
export function setRuleThreshold(
  config: RuleConfig,
  code: RuleCode,
  key: string,
  value: number,
): RuleConfig {
  const previous = config.overrides[code];
  const thresholds: Record<string, number> = { ...previous?.thresholds };

  if (SPEC_BY_KEY.get(key)?.defaultValue === value) {
    delete thresholds[key];
  } else {
    thresholds[key] = value;
  }

  // Built by mutation rather than by spreading `previous?.enabled` back in:
  // under `exactOptionalPropertyTypes` an explicit `undefined` is not the same
  // as an absent field, and "the user has not touched this switch" has to stay
  // absent for `isEmptyOverride` to read it correctly.
  const next: {
    enabled?: boolean;
    severity?: RuleSeverity;
    thresholds?: Readonly<Record<string, number>>;
  } = { ...previous };

  if (Object.keys(thresholds).length === 0) {
    delete next.thresholds;
  } else {
    next.thresholds = thresholds;
  }

  return withOverride(config, code, next);
}

/**
 * Switch a whole group on or off in one write.
 *
 * Group membership is read from `ALL_RULES` rather than from a registry
 * parameter, because the signature the screen calls has no registry to give and
 * because group is a property of a rule as written, not of the book it happens
 * to be in. One version bump for the whole group: the person pressed one
 * toggle, so one undo step is what they expect back.
 */
export function setGroupEnabled(
  config: RuleConfig,
  group: RuleGroup,
  enabled: boolean,
): RuleConfig {
  const overrides: Record<RuleCode, RuleOverride> = { ...config.overrides };

  for (const rule of ALL_RULES) {
    if (rule.group !== group) {
      continue;
    }

    const next: RuleOverride = { ...overrides[rule.code], enabled };

    if (isEmptyOverride(next)) {
      delete overrides[rule.code];
    } else {
      overrides[rule.code] = next;
    }
  }

  return { overrides: Object.freeze(overrides), version: config.version + 1 };
}

/**
 * Back to the rule book as it ships.
 *
 * Version 0, not `config.version + 1`: version 0 is defined to mean the
 * defaults, so restoring them lands back on the one version number that says
 * so, and the cache key changes because the number it held was not 0.
 */
export function resetConfig(): RuleConfig {
  return EMPTY_RULE_CONFIG;
}
