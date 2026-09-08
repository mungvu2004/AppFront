/**
 * Rule presets by building type.
 *
 * Two failures this file is written to catch specifically:
 *
 * 1. A preset referencing a rule code that does not exist in the registry —
 *    easy to type by hand from a table, easy to get wrong, and silent at
 *    the type level because `RuleCode` is a plain `string`.
 * 2. `diffPreset` reporting a wrong count. The screen that calls it exists to
 *    show the consequence of a click *before* the click commits, so the
 *    number on screen has to be the number that will actually change.
 */
import { describe, expect, it } from 'vitest';

import { setRuleEnabled, setRuleSeverity, EMPTY_RULE_CONFIG, resolveRules } from '../config';
import { defaultRuleRegistry } from '../defaults';
import { diffPreset, RULE_PRESETS, type RulePreset } from '../presets';
import type { RuleCode } from '../registry';

function presetFor(kind: 'residential' | 'commercial' | 'industrial'): RulePreset {
  const preset = RULE_PRESETS.find((candidate) => candidate.kind === kind);

  if (preset === undefined) {
    throw new Error(`không thấy preset ${kind} trong RULE_PRESETS`);
  }

  return preset;
}

describe('RULE_PRESETS', () => {
  it('has exactly the three building kinds, in order', () => {
    expect(RULE_PRESETS.map((preset) => preset.kind)).toEqual([
      'residential',
      'commercial',
      'industrial',
    ]);
  });

  it('gives each preset its Vietnamese label', () => {
    expect(presetFor('residential').label).toBe('nhà ở');
    expect(presetFor('commercial').label).toBe('văn phòng');
    expect(presetFor('industrial').label).toBe('nhà xưởng');
  });

  it('gives each preset a non-empty, lower-case-style caption', () => {
    for (const preset of RULE_PRESETS) {
      expect(preset.caption.length).toBeGreaterThan(0);
      expect(preset.caption[0]).toBe(preset.caption[0]?.toLowerCase());
    }
  });

  /** Chặn lỗi bịa mã luật: mọi mã luật mà một preset đụng tới phải thật. */
  it('only references rule codes that exist in the default registry', () => {
    const registry = defaultRuleRegistry();

    for (const preset of RULE_PRESETS) {
      const codes = Object.keys(preset.config.overrides) as RuleCode[];

      expect(codes.length).toBeGreaterThanOrEqual(0);

      for (const code of codes) {
        expect(registry.get(code)).not.toBeNull();
      }
    }
  });

  it('residential keeps every rule and threshold at its running default', () => {
    expect(presetFor('residential').config).toBe(EMPTY_RULE_CONFIG);
    expect(diffPreset(EMPTY_RULE_CONFIG, presetFor('residential'))).toEqual({
      changedRuleCount: 0,
      enabledCount: 0,
      disabledCount: 0,
      thresholdCount: 0,
      changedCodes: [],
    });
  });

  it('commercial downgrades one severity and tightens two thresholds, nothing else', () => {
    const diff = diffPreset(EMPTY_RULE_CONFIG, presetFor('commercial'));

    expect(diff.enabledCount).toBe(0);
    expect(diff.disabledCount).toBe(0);
    expect(diff.thresholdCount).toBe(2);
    expect(diff.changedRuleCount).toBe(3);
    expect(new Set(diff.changedCodes)).toEqual(
      new Set(['ROOM-NO-WINDOW', 'CORRIDOR-WIDTH', 'DOOR-BLOCKS-PATH']),
    );
  });

  it('industrial disables three residential-only rules and tightens five thresholds', () => {
    const diff = diffPreset(EMPTY_RULE_CONFIG, presetFor('industrial'));

    expect(diff.enabledCount).toBe(0);
    expect(diff.disabledCount).toBe(3);
    expect(diff.thresholdCount).toBe(5);
    expect(diff.changedRuleCount).toBe(8);
    expect(new Set(diff.changedCodes)).toEqual(
      new Set([
        'ROOM-AREA-BELOW-MINIMUM',
        'ROOM-NO-WINDOW',
        'ROOM-FURNITURE-MISMATCH',
        'CORRIDOR-WIDTH',
        'DOOR-WIDTH',
        'ESCAPE-DISTANCE',
        'WALL-THICKNESS',
        'WALL-UNSUPPORTED',
      ]),
    );
  });

  it('resolves the industrial thresholds and severities it claims to tighten', () => {
    const registry = defaultRuleRegistry();
    const resolved = resolveRules(registry, presetFor('industrial').config);
    const byCode = new Map(resolved.map((rule) => [rule.rule.code, rule]));

    expect(byCode.get('ROOM-AREA-BELOW-MINIMUM')?.enabled).toBe(false);
    expect(byCode.get('ROOM-NO-WINDOW')?.enabled).toBe(false);
    expect(byCode.get('ROOM-FURNITURE-MISMATCH')?.enabled).toBe(false);
    expect(byCode.get('DOOR-WIDTH')?.severity).toBe('critical');
    expect(byCode.get('WALL-THICKNESS')?.severity).toBe('critical');

    const doorWidth = Object.values(byCode.get('DOOR-WIDTH')?.thresholds ?? {});
    const escapeDistance = Object.values(byCode.get('ESCAPE-DISTANCE')?.thresholds ?? {});

    expect(doorWidth).toContain(1200);
    expect(escapeDistance).toContain(20000);
  });
});

describe('diffPreset', () => {
  it('counts nothing when the current config already equals the preset (idempotent apply)', () => {
    for (const preset of RULE_PRESETS) {
      expect(diffPreset(preset.config, preset)).toEqual({
        changedRuleCount: 0,
        enabledCount: 0,
        disabledCount: 0,
        thresholdCount: 0,
        changedCodes: [],
      });
    }
  });

  it('does not re-count a rule the current config already matches the preset on', () => {
    // The project already switched ROOM-NO-WINDOW off by hand, ahead of ever
    // touching the industrial preset — applying the preset should not claim
    // that rule as one more thing it would change.
    const current = setRuleEnabled(EMPTY_RULE_CONFIG, 'ROOM-NO-WINDOW', false);
    const diff = diffPreset(current, presetFor('industrial'));

    expect(diff.disabledCount).toBe(2);
    expect(diff.changedRuleCount).toBe(7);
    expect(diff.changedCodes).not.toContain('ROOM-NO-WINDOW');
  });

  it('counts a severity-only change toward changedRuleCount without touching the other counters', () => {
    // WALL-LENGTH has no threshold in the industrial preset; flip only its
    // severity by hand and confirm the diff attributes it correctly.
    const current = setRuleSeverity(EMPTY_RULE_CONFIG, 'WALL-LENGTH', 'warning');
    const preset: RulePreset = {
      kind: 'industrial',
      label: 'nhà xưởng',
      caption: 'kịch bản kiểm thử: chỉ đổi severity của một luật.',
      config: EMPTY_RULE_CONFIG,
    };

    const diff = diffPreset(current, preset);

    expect(diff.changedCodes).toEqual(['WALL-LENGTH']);
    expect(diff.enabledCount).toBe(0);
    expect(diff.disabledCount).toBe(0);
    expect(diff.thresholdCount).toBe(0);
    expect(diff.changedRuleCount).toBe(1);
  });

  it('reports both an enable and a disable in the same diff', () => {
    // ROOM-HAS-DOOR is off by default (superseded); the preset switches it on.
    // WALL-DANGLING-END is on by default; the preset switches it off.
    const current = EMPTY_RULE_CONFIG;
    const preset: RulePreset = {
      kind: 'residential',
      label: 'nhà ở',
      caption: 'kịch bản kiểm thử: một luật bật, một luật tắt.',
      config: setRuleEnabled(
        setRuleEnabled(EMPTY_RULE_CONFIG, 'ROOM-HAS-DOOR', true),
        'WALL-DANGLING-END',
        false,
      ),
    };

    const diff = diffPreset(current, preset);

    expect(diff.enabledCount).toBe(1);
    expect(diff.disabledCount).toBe(1);
    expect(diff.changedRuleCount).toBe(2);
    expect(new Set(diff.changedCodes)).toEqual(new Set(['ROOM-HAS-DOOR', 'WALL-DANGLING-END']));
  });
});
