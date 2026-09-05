/**
 * The default rule book is complete, and complete without being asked.
 *
 * This file exists because of a specific failure, and every test in it guards
 * against that failure coming back. Seventeen rules — the geometry, function
 * and fit-out groups — were written, tested, and reachable only through a
 * `register*` call that no part of the application ever made. The rules passed
 * their own tests the whole time. Nothing on screen ever ran them.
 *
 * So the assertions below are deliberately about the *default*, not about the
 * `register*` functions: those already have thorough tests next door, and their
 * being green is exactly what hid the hole. What was never asserted, and is
 * asserted here, is that a caller who asks for nothing in particular gets the
 * whole book.
 */

import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleRoomId } from '../../spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '../../spatial/normalize';
import type { SpatialGraph } from '../../spatial/types';
import { ALL_RULES, createDefaultRuleRegistry, defaultRuleRegistry } from '../defaults';
import { FITOUT_RULES } from '../fitout';
import { FUNCTION_RULES, SUPERSEDED_BUILT_IN_CODES } from '../function';
import { GEOMETRY_RULES } from '../geometry';
import { BUILT_IN_RULES } from '../registry';
import { runRules } from '../runner';

/** The four groups, and what each contributes. */
const GROUP_SIZES = {
  builtIn: BUILT_IN_RULES.length,
  fitout: FITOUT_RULES.length,
  function: FUNCTION_RULES.length,
  geometry: GEOMETRY_RULES.length,
};

const TOTAL_RULE_COUNT =
  GROUP_SIZES.builtIn + GROUP_SIZES.geometry + GROUP_SIZES.function + GROUP_SIZES.fitout;

/** The sample building with one bedroom shrunk below the 9,00 m2 floor. */
function withUndersizedRoom(): SpatialGraph {
  const graph = createSampleBuilding();

  return {
    ...graph,
    rooms: graph.rooms.map((room) =>
      room.id === sampleRoomId(0) ? { ...room, areaM2: 8 } : room,
    ),
  };
}

describe('the default rule book', () => {
  it('holds all twenty-five rules, the eight built-ins and the seventeen groups', () => {
    expect(TOTAL_RULE_COUNT).toBe(25);
    expect(ALL_RULES).toHaveLength(25);
    expect(createDefaultRuleRegistry().list()).toHaveLength(25);
  });

  it('lists them built-ins first, then geometry, function, fit-out', () => {
    expect(createDefaultRuleRegistry().list()).toEqual([...ALL_RULES]);
    expect(ALL_RULES.slice(0, GROUP_SIZES.builtIn)).toEqual([...BUILT_IN_RULES]);
    expect(ALL_RULES.slice(-GROUP_SIZES.fitout)).toEqual([...FITOUT_RULES]);
  });

  it('gives every rule a code of its own', () => {
    const codes = ALL_RULES.map((rule) => rule.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('keeps the two superseded built-ins in the book but switched off', () => {
    const registry = createDefaultRuleRegistry();

    for (const code of SUPERSEDED_BUILT_IN_CODES) {
      expect(registry.get(code)).not.toBeNull();
      expect(registry.isEnabled(code)).toBe(false);
    }

    expect(registry.listEnabled()).toHaveLength(25 - SUPERSEDED_BUILT_IN_CODES.length);
  });

  it('switches a superseded built-in back on for a project that prefers it', () => {
    const registry = createDefaultRuleRegistry();

    registry.setEnabled('ROOM-MIN-AREA', true);

    expect(registry.isEnabled('ROOM-MIN-AREA')).toBe(true);
    expect(registry.listEnabled()).toHaveLength(24);
  });

  it('builds a separate book each time, so switching one off leaks nowhere', () => {
    const first = createDefaultRuleRegistry();
    const second = createDefaultRuleRegistry();

    first.setEnabled('WALL-THICKNESS', false);

    expect(first.isEnabled('WALL-THICKNESS')).toBe(false);
    expect(second.isEnabled('WALL-THICKNESS')).toBe(true);
  });
});

/**
 * The pair the function group replaces reads the model in a simpler way — from
 * `room.wallIds` rather than from the geometry — so a project that wants the
 * simpler reading can have it back. These two tests are what makes "still in the
 * book, still reversible" a fact rather than a sentence in a doc comment.
 */
describe('the two built-ins the function group stands down', () => {
  it('reports rooms with no door again once ROOM-HAS-DOOR is switched back on', () => {
    const registry = createDefaultRuleRegistry();
    const graph = normalizeSpatial(createSampleBuilding());

    expect(
      runRules(graph, { registry }).violations.some(
        (violation) => violation.ruleCode === 'ROOM-HAS-DOOR',
      ),
    ).toBe(false);

    registry.setEnabled('ROOM-HAS-DOOR', true);
    const found = runRules(graph, { registry }).violations.filter(
      (violation) => violation.ruleCode === 'ROOM-HAS-DOOR',
    );

    // Five, not the thirteen `ROOM-NO-DOOR` finds: this rule trusts the room's
    // own `wallIds`, where its replacement checks the door is on the outline.
    expect(found).toHaveLength(5);
    expect(found[0]?.message).toContain('không có cửa đi nào');
    expect(found[0]?.suggestion).toContain('Thêm một cửa đi');
  });

  it('reports an undersized room again once ROOM-MIN-AREA is switched back on', () => {
    const registry = createDefaultRuleRegistry();

    registry.setEnabled('ROOM-MIN-AREA', true);
    const found = runRules(normalizeSpatial(withUndersizedRoom()), {
      registry,
    }).violations.filter((violation) => violation.ruleCode === 'ROOM-MIN-AREA');

    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('8,00 m²');
    expect(found[0]?.message).toContain('9,00 m²');
    expect(found[0]?.suggestion).toContain('9,00 m²');
  });
});

describe('the book the application shares', () => {
  it('is one instance, so switching a rule off is a project-wide decision', () => {
    expect(defaultRuleRegistry()).toBe(defaultRuleRegistry());
  });

  it('is the complete book, not the eight built-ins', () => {
    expect(defaultRuleRegistry().list()).toHaveLength(25);
    expect(defaultRuleRegistry().get('FURNITURE-CLASH')).not.toBeNull();
    expect(defaultRuleRegistry().isEnabled('FURNITURE-CLASH')).toBe(true);
  });

  /**
   * The regression test proper.
   *
   * `runRules(graph)` with no options is what `selectViolations` calls, which is
   * what every screen calls. It used to see eight rules. If somebody ever puts
   * the composition back behind a call the app shell has to remember, this is
   * the assertion that goes red.
   */
  it('is what a caller who asks for no registry gets', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const found = new Set(runRules(graph).violations.map((violation) => violation.ruleCode));

    expect(found).toContain('FURNITURE-CLASH');
    expect(found).toContain('WALL-DANGLING-END');
    expect(found).toContain('ROOM-NO-WINDOW');
    expect(found).toContain('WINDOW-ON-INNER-WALL');
    expect(found).toContain('OPENING-IN-WALL');
  });
});
