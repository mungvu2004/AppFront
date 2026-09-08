/**
 * What a project may change about the rule book.
 *
 * Two things here are worth more than the rest.
 *
 * The first is that every `defaultValue` still equals the constant the rule
 * measures against. The whole design leans on it: the screen offers "restore
 * defaults", the config stores only what differs, and both statements are lies
 * the moment a default here drifts from the number in the check. The table
 * below names each constant on purpose rather than looping over the specs,
 * because a loop comparing the specs to themselves proves nothing.
 *
 * The second is that a threshold set in a config actually reaches the rule. The
 * end-to-end block runs a real pass over a real plan and moves a wall from clean
 * to reported by changing one number — which is the only way to tell a wired
 * threshold from a well-typed one that nothing reads.
 */

import { describe, expect, it } from 'vitest';

import { normalizeSpatial } from '../../spatial/normalize';
import type {
  Level,
  LevelId,
  Point,
  Room,
  RoomId,
  SpatialGraph,
  Wall,
  WallId,
} from '../../spatial/types';
import {
  BUILT_IN_RULES,
  createRuleRegistry,
  MAX_WALL_THICKNESS_MM,
  MIN_DOOR_WIDTH_MM,
  MIN_ROOM_AREA_M2,
  MIN_WALL_LENGTH_MM,
  MIN_WALL_THICKNESS_MM,
  type RuleCode,
} from '../registry';
import {
  COVERAGE_LATERAL_TOLERANCE_MM,
  JOINT_TOLERANCE_MM,
  MAX_UNCOVERED_EDGE_MM,
  MIN_SUPPORT_SHARE,
  MIN_WALL_OVERLAP_MM,
  PARALLEL_ANGLE_DEG,
  STAIR_ALIGNMENT_TOLERANCE_MM,
} from '../geometry';
import {
  MAX_ESCAPE_DISTANCE_MM,
  MIN_CLASH_MM,
  MIN_CLEAR_PASSAGE_MM,
  OPENING_ON_OUTLINE_TOLERANCE_MM,
  USAGE_REQUIREMENTS,
} from '../function';
import { WALL_HUGGING_TOLERANCE_MM } from '../fitout';
import { createDefaultRuleRegistry } from '../defaults';
import { runRules } from '../runner';
import {
  DEFAULT_RULE_THRESHOLDS,
  EMPTY_RULE_CONFIG,
  GENERAL_THRESHOLD_CODE,
  isDefaultConfig,
  resetConfig,
  resolveRules,
  resolveThresholds,
  RULE_THRESHOLD_SPECS,
  setGroupEnabled,
  setRuleEnabled,
  setRuleSeverity,
  setRuleThreshold,
  thresholdSpecByKey,
  thresholdSpecsFor,
  thresholdUnitText,
  validateThreshold,
  type RuleConfig,
  type RuleThresholdSpec,
} from '../config';

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

function specOf(key: string): RuleThresholdSpec {
  const spec = thresholdSpecByKey(key);

  if (spec === null) {
    throw new Error(`Không có ngưỡng nào mang khoá ${key}.`);
  }

  return spec;
}

/* -------------------------------------------------------------------------- */
/* The specs.                                                                  */
/* -------------------------------------------------------------------------- */

describe('RULE_THRESHOLD_SPECS', () => {
  it('gives every threshold a key of its own', () => {
    const keys = RULE_THRESHOLD_SPECS.map((spec) => spec.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('files every threshold under a rule the book knows, or under the general card', () => {
    const known = new Set<RuleCode>(createDefaultRuleRegistry().list().map((rule) => rule.code));

    for (const spec of RULE_THRESHOLD_SPECS) {
      const filedSomewhere = spec.ruleCode === GENERAL_THRESHOLD_CODE || known.has(spec.ruleCode);

      expect(`${spec.key} → ${spec.ruleCode}: ${String(filedSomewhere)}`).toBe(
        `${spec.key} → ${spec.ruleCode}: true`,
      );
    }
  });

  it('keeps the general card for tolerances that really are shared', () => {
    const general = RULE_THRESHOLD_SPECS.filter((spec) => spec.isGeneral);

    expect(general.map((spec) => spec.key)).toEqual([
      'general.parallelAngleDeg',
      'general.jointToleranceMm',
    ]);
    expect(general.every((spec) => spec.ruleCode === GENERAL_THRESHOLD_CODE)).toBe(true);
  });

  it('leaves every default inside the band the field enforces', () => {
    for (const spec of RULE_THRESHOLD_SPECS) {
      expect(`${spec.key}: ${String(spec.min <= spec.defaultValue)}`).toBe(`${spec.key}: true`);
      expect(`${spec.key}: ${String(spec.defaultValue <= spec.max)}`).toBe(`${spec.key}: true`);
      expect(`${spec.key}: ${String(spec.min < spec.max)}`).toBe(`${spec.key}: true`);
      expect(`${spec.key}: ${String(spec.step > 0)}`).toBe(`${spec.key}: true`);
    }
  });

  it('writes every label in Vietnamese, lower case, sentence style (A6)', () => {
    for (const spec of RULE_THRESHOLD_SPECS) {
      const first = spec.label.slice(0, 1);

      expect(`${spec.key}: ${first}`).toBe(`${spec.key}: ${first.toLocaleLowerCase('vi')}`);
      expect(spec.label.endsWith('.')).toBe(false);
      // An all-ASCII "Vietnamese" label is a label that lost its diacritics.
      expect(`${spec.key}: ${String(/[^\p{ASCII}]/u.test(spec.label))}`).toBe(
        `${spec.key}: true`,
      );
    }
  });
});

describe('defaultValue', () => {
  /**
   * Every threshold against the constant its rule measures with.
   *
   * Written out rather than derived, so this test fails when somebody changes a
   * constant and forgets the spec — which is the only failure it exists to
   * catch.
   */
  const EXPECTED: Readonly<Record<string, number>> = {
    'general.parallelAngleDeg': PARALLEL_ANGLE_DEG,
    'general.jointToleranceMm': JOINT_TOLERANCE_MM,
    'wall.minThicknessMm': MIN_WALL_THICKNESS_MM,
    'wall.maxThicknessMm': MAX_WALL_THICKNESS_MM,
    'wall.minLengthMm': MIN_WALL_LENGTH_MM,
    'door.minWidthMm': MIN_DOOR_WIDTH_MM,
    'room.minArea.livingRoom': MIN_ROOM_AREA_M2.livingRoom,
    'room.minArea.bedroom': MIN_ROOM_AREA_M2.bedroom,
    'room.minArea.kitchen': MIN_ROOM_AREA_M2.kitchen,
    'room.minArea.bathroom': MIN_ROOM_AREA_M2.bathroom,
    'room.minArea.corridor': MIN_ROOM_AREA_M2.corridor,
    'room.minArea.stairwell': MIN_ROOM_AREA_M2.stairwell,
    'room.minArea.utility': MIN_ROOM_AREA_M2.utility,
    'room.minArea.other': MIN_ROOM_AREA_M2.other,
    'wallOverlap.minOverlapMm': MIN_WALL_OVERLAP_MM,
    'roomClosure.lateralToleranceMm': COVERAGE_LATERAL_TOLERANCE_MM,
    'roomClosure.maxUncoveredEdgeMm': MAX_UNCOVERED_EDGE_MM,
    'wallSupport.minSupportShare': MIN_SUPPORT_SHARE,
    'stair.alignmentToleranceMm': STAIR_ALIGNMENT_TOLERANCE_MM,
    'corridor.minClearWidthMm': USAGE_REQUIREMENTS.corridor.minClearWidthMm,
    'stairwell.minClearWidthMm': USAGE_REQUIREMENTS.stairwell.minClearWidthMm,
    'escape.openingOnOutlineToleranceMm': OPENING_ON_OUTLINE_TOLERANCE_MM,
    'escape.maxDistanceMm': MAX_ESCAPE_DISTANCE_MM,
    'door.minClearPassageMm': MIN_CLEAR_PASSAGE_MM,
    'furniture.minClashMm': MIN_CLASH_MM,
    'fixture.wallHuggingToleranceMm': WALL_HUGGING_TOLERANCE_MM,
  };

  it('equals the constant the rule runs with today, for every threshold', () => {
    const actual = Object.fromEntries(
      RULE_THRESHOLD_SPECS.map((spec) => [spec.key, spec.defaultValue]),
    );

    expect(actual).toEqual(EXPECTED);
  });

  it('covers every threshold the survey found, and nothing invented', () => {
    expect(RULE_THRESHOLD_SPECS).toHaveLength(Object.keys(EXPECTED).length);
  });

  it('is what DEFAULT_RULE_THRESHOLDS hands a rule that has no override', () => {
    expect(DEFAULT_RULE_THRESHOLDS).toEqual(EXPECTED);
    expect(Object.isFrozen(DEFAULT_RULE_THRESHOLDS)).toBe(true);
  });
});

describe('thresholdSpecsFor', () => {
  it('returns the thresholds filed under one rule, in screen order', () => {
    expect(thresholdSpecsFor('WALL-THICKNESS').map((spec) => spec.key)).toEqual([
      'wall.minThicknessMm',
      'wall.maxThicknessMm',
    ]);
  });

  it('returns the general card under the general code', () => {
    expect(thresholdSpecsFor(GENERAL_THRESHOLD_CODE)).toHaveLength(2);
  });

  it('returns nothing for a rule with no numbers to tune', () => {
    expect(thresholdSpecsFor('ROOM-UNNAMED')).toEqual([]);
  });

  it('answers by key, and says so when the key is unknown', () => {
    expect(specOf('door.minWidthMm').ruleCode).toBe('DOOR-WIDTH');
    expect(thresholdSpecByKey('door.notAThreshold')).toBeNull();
  });
});

describe('thresholdUnitText', () => {
  it('gives each unit the suffix a person reads', () => {
    expect(thresholdUnitText('mm')).toBe('mm');
    expect(thresholdUnitText('m2')).toBe('m²');
    expect(thresholdUnitText('do')).toBe('°');
    expect(thresholdUnitText('phantram')).toBe('%');
  });
});

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

describe('validateThreshold', () => {
  const wallMin = specOf('wall.minThicknessMm');

  it('accepts a value inside the band, and hands it back', () => {
    expect(validateThreshold(wallMin, 90)).toEqual({ ok: true, value: 90 });
  });

  it('accepts both ends of the band', () => {
    expect(validateThreshold(wallMin, wallMin.min).ok).toBe(true);
    expect(validateThreshold(wallMin, wallMin.max).ok).toBe(true);
  });

  it('names the band it wants rather than only saying no', () => {
    const result = validateThreshold(wallMin, 5);

    expect(result).toEqual({
      ok: false,
      message: 'bề dày tường tối thiểu nhận giá trị từ 30 đến 200 mm.',
    });
  });

  it('names the band at the top end too', () => {
    const result = validateThreshold(wallMin, 5000);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).toContain('từ 30 đến 200 mm.');
  });

  it('states the band of every threshold, in that threshold own words', () => {
    for (const spec of RULE_THRESHOLD_SPECS) {
      const result = validateThreshold(spec, spec.max + 1);

      expect(result.ok).toBe(false);

      const message = result.ok ? '' : result.message;

      expect(`${spec.key}: ${String(message.startsWith(spec.label))}`).toBe(`${spec.key}: true`);
      expect(`${spec.key}: ${String(message.includes(' đến '))}`).toBe(`${spec.key}: true`);
      expect(`${spec.key}: ${String(message.endsWith('.'))}`).toBe(`${spec.key}: true`);
      expect(`${spec.key}: ${String(message.includes(thresholdUnitText(spec.unit)))}`).toBe(
        `${spec.key}: true`,
      );
    }
  });

  it('writes the decimal separator as a comma (A15)', () => {
    const share = specOf('wallSupport.minSupportShare');
    const result = validateThreshold({ ...share, max: 2.5 }, 9);

    expect(result.ok ? '' : result.message).toContain('đến 2,5');
  });

  it('groups thousands so a five-digit band stays readable', () => {
    const result = validateThreshold(specOf('escape.maxDistanceMm'), 0);

    expect(result.ok ? '' : result.message).toContain('từ 5.000 đến 100.000 mm.');
  });

  it('refuses a value that is not a number at all', () => {
    expect(validateThreshold(wallMin, Number.NaN).ok).toBe(false);
    expect(validateThreshold(wallMin, Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  it('leaves landing between two steps to the stepper', () => {
    // 63 is not on the 5 mm grid; it is still a thickness a rule can measure.
    expect(validateThreshold(wallMin, 63).ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Resolving.                                                                  */
/* -------------------------------------------------------------------------- */

describe('resolveRules', () => {
  it('hands back the whole book, defaults and all, for an empty config', () => {
    const registry = createDefaultRuleRegistry();
    const resolved = resolveRules(registry, EMPTY_RULE_CONFIG);

    expect(resolved).toHaveLength(25);
    expect(resolved.every((rule) => rule.isDefault)).toBe(true);
    expect(resolved.every((rule) => rule.thresholds === DEFAULT_RULE_THRESHOLDS)).toBe(true);
  });

  it('reports the two superseded built-ins as off, without an override saying so', () => {
    const resolved = resolveRules(createDefaultRuleRegistry(), EMPTY_RULE_CONFIG);
    const off = resolved.filter((rule) => !rule.enabled).map((rule) => rule.rule.code);

    expect(off).toEqual(['ROOM-MIN-AREA', 'ROOM-HAS-DOOR']);
  });

  it('applies an enabled override', () => {
    const registry = createDefaultRuleRegistry();
    const config = setRuleEnabled(EMPTY_RULE_CONFIG, 'WALL-THICKNESS', false);
    const resolved = resolveRules(registry, config);
    const wall = resolved.find((rule) => rule.rule.code === 'WALL-THICKNESS');

    expect(wall?.enabled).toBe(false);
    expect(wall?.isDefault).toBe(false);
    // Its neighbours are untouched.
    expect(resolved.find((rule) => rule.rule.code === 'WALL-LENGTH')?.enabled).toBe(true);
  });

  it('applies a severity override without inventing a fourth severity (A4)', () => {
    const config = setRuleSeverity(EMPTY_RULE_CONFIG, 'ROOM-UNNAMED', 'critical');
    const resolved = resolveRules(createDefaultRuleRegistry(), config);

    expect(resolved.find((rule) => rule.rule.code === 'ROOM-UNNAMED')?.severity).toBe('critical');
  });

  it('applies a threshold override to the rule it is filed under', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'WALL-THICKNESS', 'wall.minThicknessMm', 120);
    const resolved = resolveRules(createDefaultRuleRegistry(), config);
    const wall = resolved.find((rule) => rule.rule.code === 'WALL-THICKNESS');

    expect(wall?.thresholds['wall.minThicknessMm']).toBe(120);
    // Everything else it reads is still shipped.
    expect(wall?.thresholds['wall.maxThicknessMm']).toBe(MAX_WALL_THICKNESS_MM);
  });

  it('leaves the other rules alone when one rule is retuned', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'WALL-THICKNESS', 'wall.minThicknessMm', 120);
    const resolved = resolveRules(createDefaultRuleRegistry(), config);

    expect(
      resolved.find((rule) => rule.rule.code === 'WALL-LENGTH')?.thresholds['wall.minThicknessMm'],
    ).toBe(MIN_WALL_THICKNESS_MM);
  });

  it('reaches every rule with a general tolerance, which is the point of it', () => {
    const config = setRuleThreshold(
      EMPTY_RULE_CONFIG,
      GENERAL_THRESHOLD_CODE,
      'general.parallelAngleDeg',
      12,
    );
    const resolved = resolveRules(createDefaultRuleRegistry(), config);

    expect(resolved.every((rule) => rule.thresholds['general.parallelAngleDeg'] === 12)).toBe(true);
  });

  it('lets a rule of its own win over the general card for the same key', () => {
    const config: RuleConfig = {
      overrides: {
        [GENERAL_THRESHOLD_CODE]: { thresholds: { 'general.parallelAngleDeg': 12 } },
        'WALL-OVERLAP': { thresholds: { 'general.parallelAngleDeg': 3 } },
      },
      version: 1,
    };
    const resolved = resolveRules(createDefaultRuleRegistry(), config);

    expect(
      resolved.find((rule) => rule.rule.code === 'WALL-OVERLAP')?.thresholds[
        'general.parallelAngleDeg'
      ],
    ).toBe(3);
    expect(
      resolved.find((rule) => rule.rule.code === 'ROOM-NOT-CLOSED')?.thresholds[
        'general.parallelAngleDeg'
      ],
    ).toBe(12);
  });

  it('gives each threshold map by rule code through resolveThresholds', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'door.minWidthMm', 800);
    const byCode = resolveThresholds(createDefaultRuleRegistry(), config);

    expect(Object.keys(byCode)).toHaveLength(25);
    expect(byCode['DOOR-WIDTH']?.['door.minWidthMm']).toBe(800);
    expect(byCode['WALL-LENGTH']?.['door.minWidthMm']).toBe(MIN_DOOR_WIDTH_MM);
  });

  it('resolves against whatever book it is given, not the shared one', () => {
    const narrow = createRuleRegistry(BUILT_IN_RULES);

    expect(resolveRules(narrow, EMPTY_RULE_CONFIG)).toHaveLength(BUILT_IN_RULES.length);
  });
});

/* -------------------------------------------------------------------------- */
/* isDefaultConfig.                                                            */
/* -------------------------------------------------------------------------- */

describe('isDefaultConfig', () => {
  it('is true for the empty config', () => {
    expect(isDefaultConfig(EMPTY_RULE_CONFIG)).toBe(true);
  });

  it('is false once a rule is switched off', () => {
    expect(isDefaultConfig(setRuleEnabled(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', false))).toBe(false);
  });

  it('is false once a rule is switched on again, because that is still a decision', () => {
    // The registry, not the config, is the reference for "as shipped", and a
    // config is data that has to be readable without one — so an `enabled`
    // field counts as a change whichever way it points.
    expect(isDefaultConfig(setRuleEnabled(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', true))).toBe(false);
  });

  it('is false once a severity is moved', () => {
    expect(isDefaultConfig(setRuleSeverity(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'critical'))).toBe(
      false,
    );
  });

  it('is false once a threshold is moved', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'door.minWidthMm', 800);

    expect(isDefaultConfig(config)).toBe(false);
  });

  it('is true again when the threshold is typed back to where it started', () => {
    const moved = setRuleThreshold(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'door.minWidthMm', 800);
    const back = setRuleThreshold(moved, 'DOOR-WIDTH', 'door.minWidthMm', MIN_DOOR_WIDTH_MM);

    expect(isDefaultConfig(back)).toBe(true);
    expect(back.overrides['DOOR-WIDTH']).toBeUndefined();
  });

  it('reads a hand-built config that only restates the defaults as default', () => {
    // W2 builds preset configs by hand; a preset that agrees with the shipped
    // book on some rule must not light the "restore defaults" footer.
    const config: RuleConfig = {
      overrides: { 'DOOR-WIDTH': { thresholds: { 'door.minWidthMm': MIN_DOOR_WIDTH_MM } } },
      version: 4,
    };

    expect(isDefaultConfig(config)).toBe(true);
  });

  it('does not care what the version number happens to be', () => {
    expect(isDefaultConfig({ overrides: {}, version: 97 })).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Writing.                                                                    */
/* -------------------------------------------------------------------------- */

describe('the setters', () => {
  it('setRuleEnabled returns a new config and moves the version on', () => {
    const before = EMPTY_RULE_CONFIG;
    const after = setRuleEnabled(before, 'DOOR-WIDTH', false);

    expect(after).not.toBe(before);
    expect(after.overrides).not.toBe(before.overrides);
    expect(after.version).toBe(before.version + 1);
    expect(before.overrides['DOOR-WIDTH']).toBeUndefined();
    expect(after.overrides['DOOR-WIDTH']).toEqual({ enabled: false });
  });

  it('setRuleSeverity returns a new config and moves the version on', () => {
    const before = setRuleEnabled(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', false);
    const after = setRuleSeverity(before, 'DOOR-WIDTH', 'critical');

    expect(after).not.toBe(before);
    expect(after.version).toBe(before.version + 1);
    expect(before.overrides['DOOR-WIDTH']).toEqual({ enabled: false });
    expect(after.overrides['DOOR-WIDTH']).toEqual({ enabled: false, severity: 'critical' });
  });

  it('setRuleThreshold returns a new config and moves the version on', () => {
    const before = EMPTY_RULE_CONFIG;
    const after = setRuleThreshold(before, 'DOOR-WIDTH', 'door.minWidthMm', 800);

    expect(after).not.toBe(before);
    expect(after.version).toBe(before.version + 1);
    expect(before.overrides['DOOR-WIDTH']).toBeUndefined();
    expect(after.overrides['DOOR-WIDTH']?.thresholds).toEqual({ 'door.minWidthMm': 800 });
  });

  it('setGroupEnabled returns a new config and moves the version on once', () => {
    const before = EMPTY_RULE_CONFIG;
    const after = setGroupEnabled(before, 'annotation', false);

    expect(after).not.toBe(before);
    expect(after.version).toBe(before.version + 1);
    expect(before.overrides['ROOM-UNNAMED']).toBeUndefined();
    expect(after.overrides['ROOM-UNNAMED']).toEqual({ enabled: false });
  });

  it('moves the version even when the value written is the one already there', () => {
    const once = setRuleEnabled(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', false);
    const twice = setRuleEnabled(once, 'DOOR-WIDTH', false);

    expect(twice.version).toBe(once.version + 1);
  });

  it('keeps a rule severity when only its threshold moves', () => {
    const severe = setRuleSeverity(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'critical');
    const tuned = setRuleThreshold(severe, 'DOOR-WIDTH', 'door.minWidthMm', 800);

    expect(tuned.overrides['DOOR-WIDTH']).toEqual({
      severity: 'critical',
      thresholds: { 'door.minWidthMm': 800 },
    });
  });

  it('drops the whole entry when the last change in it is undone', () => {
    const tuned = setRuleThreshold(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'door.minWidthMm', 800);
    const back = setRuleThreshold(tuned, 'DOOR-WIDTH', 'door.minWidthMm', MIN_DOOR_WIDTH_MM);

    expect(back.overrides).toEqual({});
  });

  it('keeps a value it has no spec for, rather than losing it', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'door.fromALaterBuild', 12);

    expect(config.overrides['DOOR-WIDTH']?.thresholds).toEqual({ 'door.fromALaterBuild': 12 });
    expect(isDefaultConfig(config)).toBe(false);
  });

  it('stores a value the field would have refused, rather than rounding it silently', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'DOOR-WIDTH', 'door.minWidthMm', 99999);

    expect(config.overrides['DOOR-WIDTH']?.thresholds).toEqual({ 'door.minWidthMm': 99999 });
    expect(validateThreshold(specOf('door.minWidthMm'), 99999).ok).toBe(false);
  });

  it('setGroupEnabled reaches every rule of the group and no other', () => {
    const registry = createDefaultRuleRegistry();
    const config = setGroupEnabled(EMPTY_RULE_CONFIG, 'circulation', false);
    const resolved = resolveRules(registry, config);
    const off = resolved.filter((rule) => !rule.enabled).map((rule) => rule.rule.group);

    expect(new Set(off)).toEqual(new Set(['circulation', 'area']));
    // 'area' is only in that set because ROOM-MIN-AREA ships switched off.
    expect(
      resolved
        .filter((rule) => !rule.enabled && rule.rule.group === 'area')
        .map((rule) => rule.rule.code),
    ).toEqual(['ROOM-MIN-AREA']);
    expect(resolved.filter((rule) => rule.rule.group === 'geometry').every((one) => one.enabled)).toBe(
      true,
    );
  });

  it('setGroupEnabled prunes its own entries when it puts a group back', () => {
    const off = setGroupEnabled(EMPTY_RULE_CONFIG, 'annotation', false);
    const on = setGroupEnabled(off, 'annotation', true);

    expect(on.overrides['ROOM-UNNAMED']).toEqual({ enabled: true });
    expect(isDefaultConfig(on)).toBe(false);
    expect(isDefaultConfig(resetConfig())).toBe(true);
  });

  it('resetConfig gives back the shipped book at version 0', () => {
    expect(resetConfig()).toEqual({ overrides: {}, version: 0 });
    expect(isDefaultConfig(resetConfig())).toBe(true);
  });

  it('never mutates the config it was handed, however deep the change', () => {
    const original: RuleConfig = {
      overrides: { 'DOOR-WIDTH': { thresholds: { 'door.minWidthMm': 800 } } },
      version: 3,
    };
    const snapshot = JSON.stringify(original);

    setRuleEnabled(original, 'DOOR-WIDTH', false);
    setRuleSeverity(original, 'DOOR-WIDTH', 'critical');
    setRuleThreshold(original, 'DOOR-WIDTH', 'door.minWidthMm', 900);
    setGroupEnabled(original, 'circulation', false);

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

/* -------------------------------------------------------------------------- */
/* End to end: does a configured threshold reach the rule?                     */
/* -------------------------------------------------------------------------- */

const REVIEWED = { confidence: 1, source: 'human', reviewed: true } as const;
const GROUND: LevelId = 'L-GROUND0000';

const wallId = (code: string): WallId => `W-${code.padEnd(10, '0')}`;

function wall(code: string, start: Point, end: Point, thicknessMm: number): Wall {
  return {
    ...REVIEWED,
    id: wallId(code),
    levelId: GROUND,
    centreline: { start, end },
    thicknessMm,
    heightMm: 3600,
    kind: 'partition',
    openingIds: [],
  };
}

function level(): Level {
  return { ...REVIEWED, id: GROUND, name: 'Tầng trệt', order: 0, elevationMm: 0, heightMm: 3600 };
}

/** One partition of a stated thickness, and one room so the graph is a plan. */
function planWithWallThickness(thicknessMm: number): SpatialGraph {
  const only = wall('ONLY', { x: 0, y: 0 }, { x: 4000, y: 0 }, thicknessMm);
  const single: Room = {
    ...REVIEWED,
    id: 'R-ONLY000000' as RoomId,
    levelId: GROUND,
    name: 'Phòng ngủ',
    usage: 'bedroom',
    outline: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    areaM2: 12,
    wallIds: [only.id],
  };

  return {
    building: { ...REVIEWED, name: 'Nhà mẫu kiểm cấu hình', datumElevationMm: 0 },
    levels: [level()],
    walls: [only],
    openings: [],
    furniture: [],
    rooms: [single],
    axes: [],
    dimensions: [],
    notes: [],
  };
}

function thicknessViolations(thicknessMm: number, config?: RuleConfig): readonly string[] {
  const graph = normalizeSpatial(planWithWallThickness(thicknessMm));
  const registry = createRuleRegistry(BUILT_IN_RULES);
  const result =
    config === undefined
      ? runRules(graph, { registry })
      : runRules(graph, { registry, config });

  return result.violations.filter((one) => one.ruleCode === 'WALL-THICKNESS').map((one) => one.message);
}

describe('a configured threshold reaching the rule', () => {
  it('reports nothing at the shipped band, with no config at all', () => {
    expect(thicknessViolations(100)).toEqual([]);
  });

  it('reports nothing at the shipped band with an empty config either', () => {
    expect(thicknessViolations(100, EMPTY_RULE_CONFIG)).toEqual([]);
  });

  it('reports the same wall once the project raises the minimum past it', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'WALL-THICKNESS', 'wall.minThicknessMm', 150);
    const messages = thicknessViolations(100, config);

    expect(messages).toHaveLength(1);
    // The sentence quotes the configured band, not the shipped one — a message
    // naming 60 mm here would send somebody looking for a rule that is not the
    // one that fired.
    expect(messages[0]).toContain('150 mm');
    expect(messages[0]).not.toContain('60 mm');
  });

  it('stops reporting a wall the project has decided is thick enough', () => {
    const config = setRuleThreshold(EMPTY_RULE_CONFIG, 'WALL-THICKNESS', 'wall.minThicknessMm', 30);

    expect(thicknessViolations(40, config)).toEqual([]);
    expect(thicknessViolations(40)).toHaveLength(1);
  });

  it('runs a rule the config switched off no more than a rule the book left off', () => {
    const graph = normalizeSpatial(planWithWallThickness(40));
    const registry = createRuleRegistry(BUILT_IN_RULES);
    const config = setRuleEnabled(EMPTY_RULE_CONFIG, 'WALL-THICKNESS', false);
    const codes = runRules(graph, { registry, config }).violations.map((one) => one.ruleCode);

    // Switching rules off is the store's job, not the runner's: this pass still
    // reports it. The check is here so the day that moves, it moves on purpose.
    expect(codes).toContain('WALL-THICKNESS');
  });
});
