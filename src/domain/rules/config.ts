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
 * **Every shipped value is the running constant, not a copy of it.**
 * {@link DEFAULT_RULE_THRESHOLDS} imports `MIN_WALL_THICKNESS_MM`,
 * `PARALLEL_ANGLE_DEG` and the rest from the modules that measure against them.
 * A number retyped here would drift the first time somebody tuned a rule, and
 * the screen would then offer to "restore defaults" that had never been the
 * defaults.
 *
 * **What is *not* here: the fields a person edits.** A label, a unit, a `min`
 * and a `max` are interface vocabulary — the rule engine never reads one. They
 * live in `thresholdSpecs.ts`, which imports {@link DEFAULT_RULE_THRESHOLDS} for
 * every `defaultValue` so there is still exactly one source of truth per number.
 * The split is load-bearing rather than tidy: `runner.ts` imports *values* from
 * this module, so this module sits in the static graph of every screen that
 * runs a rule pass, and twenty-six Vietnamese labels no engine reads have no
 * business riding along. `RuleThresholdSpec` and `ThresholdValidation` are
 * declared here because a type costs nothing at run time and the vocabulary
 * belongs with the configuration it describes.
 */

import {
  MAX_WALL_THICKNESS_MM,
  MIN_DOOR_WIDTH_MM,
  MIN_ROOM_AREA_M2,
  MIN_WALL_LENGTH_MM,
  MIN_WALL_THICKNESS_MM,
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

export type { RuleThresholds } from './registry';

/* -------------------------------------------------------------------------- */
/* One adjustable number.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What a threshold is measured in.
 *
 * ASCII names rather than the symbols themselves, so the value can be switched
 * on and stored without a mojibake risk; `thresholdUnitText` in
 * `thresholdSpecs.ts` turns each into the suffix a person reads in the field.
 *
 * `'tile'` is a bare ratio between 0 and 1, and it is deliberately *not*
 * `'phantram'`. A rule that measures a share stores the share it measures — the
 * constant is `0,8`, and restating it as `80` here would make `defaultValue`
 * something other than the number the check runs with, which is the one thing
 * these specs are not allowed to be. Turning `0,8` into `80 %` is a formatting
 * decision, and A15 puts formatting in the viewmodel rather than in the domain
 * or the view; the screen's hook is what does it.
 */
export type RuleThresholdUnit = 'mm' | 'm2' | 'do' | 'phantram' | 'tile';

/**
 * One number a project may change, and the band it may change it inside.
 *
 * The type lives here; the twenty-six values live in `thresholdSpecs.ts`, which
 * only the settings screen imports.
 */
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

/** Either a value the rule can run with, or a sentence saying what would be. */
export type ThresholdValidation =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string };

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
 * Built rather than typed out because the eight differ in exactly one thing —
 * the use — and eight hand-written lines is eight chances to pair a use with
 * the wrong constant, plus one more use added next door that nobody adds here.
 *
 * A zero switches the check off for that use, which is what the four shipped
 * zeros already mean: the rule skips a use whose minimum is not positive, so a
 * corridor is never measured against `0`.
 */
function roomAreaThresholds(): Record<string, number> {
  const uses = Object.keys(MIN_ROOM_AREA_M2) as readonly RoomUsage[];

  return Object.fromEntries(uses.map((usage) => [`room.minArea.${usage}`, MIN_ROOM_AREA_M2[usage]]));
}

/**
 * Every threshold at its shipped value.
 *
 * One frozen object, shared by every rule that has no override of its own, so
 * an unconfigured pass allocates nothing per rule and `resolveRules` can hand
 * the same reference to all twenty-five.
 *
 * Every value is the imported constant. The keys are stated here rather than
 * derived from the screen's spec table, so that the engine's copy of the
 * defaults is reachable without the spec table being in the bundle at all;
 * `thresholdSpecs.ts` reads each `defaultValue` back out of this map, and
 * `__tests__/thresholdSpecs.test.ts` refuses a key that exists on one side and
 * not the other.
 */
export const DEFAULT_RULE_THRESHOLDS: RuleThresholds = Object.freeze({
  /* -- Shared geometric tolerances --------------------------------------- */
  'general.parallelAngleDeg': PARALLEL_ANGLE_DEG,
  'general.jointToleranceMm': JOINT_TOLERANCE_MM,
  /* -- WALL-THICKNESS ----------------------------------------------------- */
  'wall.minThicknessMm': MIN_WALL_THICKNESS_MM,
  'wall.maxThicknessMm': MAX_WALL_THICKNESS_MM,
  /* -- WALL-LENGTH -------------------------------------------------------- */
  'wall.minLengthMm': MIN_WALL_LENGTH_MM,
  /* -- DOOR-WIDTH --------------------------------------------------------- */
  'door.minWidthMm': MIN_DOOR_WIDTH_MM,
  /* -- ROOM-AREA-BELOW-MINIMUM -------------------------------------------- */
  ...roomAreaThresholds(),
  /* -- WALL-OVERLAP ------------------------------------------------------- */
  'wallOverlap.minOverlapMm': MIN_WALL_OVERLAP_MM,
  /* -- ROOM-NOT-CLOSED ---------------------------------------------------- */
  'roomClosure.lateralToleranceMm': COVERAGE_LATERAL_TOLERANCE_MM,
  'roomClosure.maxUncoveredEdgeMm': MAX_UNCOVERED_EDGE_MM,
  /* -- WALL-UNSUPPORTED --------------------------------------------------- */
  'wallSupport.minSupportShare': MIN_SUPPORT_SHARE,
  /* -- STAIR-ALIGNMENT ---------------------------------------------------- */
  'stair.alignmentToleranceMm': STAIR_ALIGNMENT_TOLERANCE_MM,
  /* -- CORRIDOR-WIDTH ----------------------------------------------------- */
  'corridor.minClearWidthMm': USAGE_REQUIREMENTS.corridor.minClearWidthMm,
  'stairwell.minClearWidthMm': USAGE_REQUIREMENTS.stairwell.minClearWidthMm,
  /* -- ESCAPE-DISTANCE ---------------------------------------------------- */
  'escape.openingOnOutlineToleranceMm': OPENING_ON_OUTLINE_TOLERANCE_MM,
  'escape.maxDistanceMm': MAX_ESCAPE_DISTANCE_MM,
  /* -- DOOR-BLOCKS-PATH --------------------------------------------------- */
  'door.minClearPassageMm': MIN_CLEAR_PASSAGE_MM,
  /* -- FURNITURE-CLASH ---------------------------------------------------- */
  'furniture.minClashMm': MIN_CLASH_MM,
  /* -- FIXTURE-OFF-WALL --------------------------------------------------- */
  'fixture.wallHuggingToleranceMm': WALL_HUGGING_TOLERANCE_MM,
});

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
 * typing rather than only by pressing restore. A key this build does not know
 * is a change by that reading, which is right: it survives round-tripping
 * through a saved project rather than being silently swallowed. `enabled` and
 * `severity` are counted whenever they are present at all: telling default from
 * non-default for those needs the rule book, and a config is data that has to
 * be readable without one. The setters keep this honest by pruning as they
 * write.
 */
function isEmptyOverride(override: RuleOverride | undefined): boolean {
  if (override === undefined) {
    return true;
  }

  if (override.enabled !== undefined || override.severity !== undefined) {
    return false;
  }

  return Object.entries(override.thresholds ?? {}).every(
    ([key, value]) => DEFAULT_RULE_THRESHOLDS[key] === value,
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
 * The value is stored as given. Clamping belongs to `validateThreshold` at the
 * field, where there is somewhere to say why — silently rounding a number the
 * user typed is the same lie in a quieter voice.
 */
export function setRuleThreshold(
  config: RuleConfig,
  code: RuleCode,
  key: string,
  value: number,
): RuleConfig {
  const previous = config.overrides[code];
  const thresholds: Record<string, number> = { ...previous?.thresholds };

  if (DEFAULT_RULE_THRESHOLDS[key] === value) {
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
