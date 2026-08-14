/**
 * The keyboard: the bindings, the resolver, and the table generated from both.
 *
 * The file is organised around the three promises the module makes.
 *
 * - **No key does two things.** `shortcutConflicts` is checked twice: once
 *   against the shipped table, where it must find nothing, and once against a
 *   deliberately broken one, where it must find the clash. A checker that
 *   always answered "no conflicts" would pass the first test and fail the
 *   second, which is the point of having both.
 * - **Nothing fires while somebody is typing.** Every tool key and every
 *   modifier is replayed with the focus in a field, and the resolver must
 *   answer `null` to all eleven — not "usually", not "for letters".
 * - **The table is generated.** Each tool row is compared with the tool's own
 *   `label` and `description`, so a row that had been typed out by hand would
 *   fail as soon as the tool's wording changed.
 *
 * The last test prints the table, the way the permissions matrix is printed, so
 * a review reads the shipped keyboard out of the test log rather than out of
 * the source.
 */

import { describe, expect, it } from 'vitest';

import { TOOLS } from '../tools';
import { TOOL_IDS, type ToolId } from '../toolMachine';
import {
  applyShortcut,
  clearModifiers,
  isTextEntryTarget,
  MODIFIER_SHORTCUTS,
  modifierForShortcut,
  NO_MODIFIERS,
  normaliseKey,
  RESERVED_KEYS,
  resolveKeyDown,
  resolveKeyUp,
  SHORTCUT_BINDINGS,
  shortcutConflicts,
  shortcutForTool,
  TOOL_SHORTCUTS,
  toolForShortcut,
  type ModifierState,
  type ShortcutAction,
  type ShortcutTarget,
  type ToolModifier,
} from '../shortcuts';
import {
  buildShortcutTable,
  SHORTCUT_SECTION_LABELS,
  SHORTCUT_TABLE,
  shortcutRowFor,
  shortcutRows,
} from '../shortcutTable';

/* -------------------------------------------------------------------------- */
/* Fixture.                                                                    */
/* -------------------------------------------------------------------------- */

/** The eight bindings the brief asked for, restated so the test can disagree. */
const EXPECTED_TOOL_KEYS: Readonly<Record<ToolId, string>> = {
  select: 'V',
  pan: 'H',
  drawWall: 'W',
  placeOpening: 'D',
  placeFurniture: 'F',
  measure: 'M',
  splitWall: 'X',
  annotate: 'G',
};

const CANVAS: ShortcutTarget = { tagName: 'CANVAS' };
const TEXT_FIELD: ShortcutTarget = { tagName: 'INPUT' };

/** Every key this build binds, tools and modifiers together. */
const ALL_CODES: readonly string[] = [
  ...TOOL_IDS.map((tool) => TOOL_SHORTCUTS[tool]),
  ...MODIFIER_SHORTCUTS.map((shortcut) => shortcut.code),
];

/* -------------------------------------------------------------------------- */
/* The bindings.                                                               */
/* -------------------------------------------------------------------------- */

describe('the shortcut bindings', () => {
  it('binds V, H, W, D, F, M, X and G to the eight tools', () => {
    expect(TOOL_SHORTCUTS).toEqual(EXPECTED_TOOL_KEYS);

    for (const tool of TOOL_IDS) {
      expect(`${tool}:${shortcutForTool(tool)}`).toBe(`${tool}:${EXPECTED_TOOL_KEYS[tool]}`);
    }
  });

  it('gives every tool a key, and gives no key to two tools', () => {
    const codes = TOOL_IDS.map((tool) => TOOL_SHORTCUTS[tool]);

    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
  });

  it('binds Shift, Alt and the space bar to the three modifiers', () => {
    expect(MODIFIER_SHORTCUTS.map((shortcut) => [shortcut.code, shortcut.modifier])).toEqual([
      ['SHIFT', 'lockAxis'],
      ['ALT', 'suspendSnap'],
      ['SPACE', 'panOverride'],
    ]);
  });

  it('uses a single upper-case letter for every tool key', () => {
    for (const tool of TOOL_IDS) {
      expect(`${tool}:${TOOL_SHORTCUTS[tool]}`).toMatch(/^[a-zA-Z]+:[A-Z]$/);
    }
  });

  it('describes every modifier in lower case sentence style, as invariant A6 requires', () => {
    for (const shortcut of MODIFIER_SHORTCUTS) {
      expect(shortcut.label).toBe(shortcut.label.toLowerCase());
      expect(shortcut.description.trim()).not.toBe('');
      expect(shortcut.keyLabel.trim()).not.toBe('');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* No key is bound twice.                                                      */
/* -------------------------------------------------------------------------- */

describe('checking for clashes', () => {
  it('finds no clash in the keyboard this build ships', () => {
    expect(shortcutConflicts()).toEqual([]);
  });

  it('binds eleven distinct keys in total', () => {
    expect(ALL_CODES).toHaveLength(11);
    expect(new Set(ALL_CODES.map((code) => normaliseKey(code))).size).toBe(11);
  });

  it('takes none of the keys the interface reserves', () => {
    const reserved = new Set(RESERVED_KEYS.map((code) => normaliseKey(code)));

    for (const code of ALL_CODES) {
      expect(`${code}:${reserved.has(normaliseKey(code))}`).toBe(`${code}:false`);
    }
  });

  it('reports a key given to two tools', () => {
    const clashing = shortcutConflicts({
      ...SHORTCUT_BINDINGS,
      tools: { ...TOOL_SHORTCUTS, annotate: 'V' },
    });

    expect(clashing).toHaveLength(1);
    expect(clashing[0]?.code).toBe('V');
    expect(clashing[0]?.boundTo).toEqual(['tool:select', 'tool:annotate']);
    expect(clashing[0]?.reason).toContain('2 chức năng');
  });

  it('reports a tool key that collides with a modifier', () => {
    const clashing = shortcutConflicts({
      ...SHORTCUT_BINDINGS,
      tools: { ...TOOL_SHORTCUTS, measure: 'SHIFT' },
    });

    expect(clashing.map((conflict) => conflict.code)).toEqual(['SHIFT']);
    expect(clashing[0]?.boundTo).toEqual(['tool:measure', 'modifier:lockAxis']);
  });

  it('reports a binding that took a reserved key', () => {
    const clashing = shortcutConflicts({
      ...SHORTCUT_BINDINGS,
      tools: { ...TOOL_SHORTCUTS, splitWall: 'Escape' },
    });

    expect(clashing.map((conflict) => conflict.code)).toEqual(['ESCAPE']);
    expect(clashing[0]?.reason).toContain('dành cho giao diện');
  });
});

/* -------------------------------------------------------------------------- */
/* Not while somebody is typing.                                               */
/* -------------------------------------------------------------------------- */

describe('a focus inside a field', () => {
  it('swallows all eleven keys', () => {
    for (const code of ALL_CODES) {
      const key = code === 'SPACE' ? ' ' : code;

      expect(`${code}:${String(resolveKeyDown({ key }, TEXT_FIELD))}`).toBe(`${code}:null`);
    }
  });

  it('counts every input, a text area, a select and editable content', () => {
    expect(isTextEntryTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'input' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('counts neither the canvas nor an ordinary element nor an absent target', () => {
    expect(isTextEntryTarget(CANVAS)).toBe(false);
    expect(isTextEntryTarget({ tagName: 'DIV' })).toBe(false);
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });

  it('still lets a held key go, so a modifier cannot stick down', () => {
    expect(resolveKeyUp({ key: 'Shift' })).toEqual({
      kind: 'releaseModifier',
      modifier: 'lockAxis',
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Resolving a press.                                                          */
/* -------------------------------------------------------------------------- */

describe('resolving a key press', () => {
  it('reaches every tool from the canvas', () => {
    for (const tool of TOOL_IDS) {
      expect(resolveKeyDown({ key: TOOL_SHORTCUTS[tool] }, CANVAS)).toEqual({
        kind: 'activateTool',
        tool,
      });
    }
  });

  it('reads a lower-case letter as the same key', () => {
    expect(resolveKeyDown({ key: 'w' }, CANVAS)).toEqual({ kind: 'activateTool', tool: 'drawWall' });
    expect(toolForShortcut('x')).toBe('splitWall');
  });

  it('reaches a tool while Shift is held, because Shift only locks the axis', () => {
    expect(resolveKeyDown({ key: 'W', shiftKey: true }, CANVAS)).toEqual({
      kind: 'activateTool',
      tool: 'drawWall',
    });
  });

  it('leaves a chord with Ctrl or Cmd to the shell', () => {
    expect(resolveKeyDown({ key: 'W', ctrlKey: true }, CANVAS)).toBeNull();
    expect(resolveKeyDown({ key: 'W', metaKey: true }, CANVAS)).toBeNull();
  });

  it('leaves a letter pressed with Alt alone, since Alt is the snapping modifier', () => {
    expect(resolveKeyDown({ key: 'W', altKey: true }, CANVAS)).toBeNull();
  });

  it('takes an auto-repeat for what it is, not a second press', () => {
    expect(resolveKeyDown({ key: 'W', repeat: true }, CANVAS)).toBeNull();
    expect(resolveKeyDown({ key: ' ', repeat: true }, CANVAS)).toBeNull();
  });

  it('answers nothing for a key bound to nothing', () => {
    expect(resolveKeyDown({ key: 'Q' }, CANVAS)).toBeNull();
    expect(resolveKeyDown({ key: 'Escape' }, CANVAS)).toBeNull();
    expect(resolveKeyUp({ key: 'W' })).toBeNull();
  });

  it('holds Shift and Alt down, and lets them go again', () => {
    expect(resolveKeyDown({ key: 'Shift', shiftKey: true }, CANVAS)).toEqual({
      kind: 'holdModifier',
      modifier: 'lockAxis',
    });
    expect(resolveKeyDown({ key: 'Alt', altKey: true }, CANVAS)).toEqual({
      kind: 'holdModifier',
      modifier: 'suspendSnap',
    });
    expect(resolveKeyUp({ key: 'Alt' })).toEqual({
      kind: 'releaseModifier',
      modifier: 'suspendSnap',
    });
  });

  it('reads both spellings of the space bar', () => {
    expect(normaliseKey(' ')).toBe('SPACE');
    expect(normaliseKey('Spacebar')).toBe('SPACE');
    expect(modifierForShortcut(' ')?.modifier).toBe('panOverride');
  });

  it('holds the space bar as an overlay and never activates the pan tool with it', () => {
    const pressed = resolveKeyDown({ key: ' ' }, CANVAS);

    expect(pressed).toEqual({ kind: 'holdModifier', modifier: 'panOverride' });
    expect(pressed?.kind).not.toBe('activateTool');
    expect(resolveKeyUp({ key: ' ' })).toEqual({
      kind: 'releaseModifier',
      modifier: 'panOverride',
    });
  });
});

/* -------------------------------------------------------------------------- */
/* The held keys.                                                              */
/* -------------------------------------------------------------------------- */

describe('the held-key state', () => {
  const fold = (actions: readonly ShortcutAction[]): ModifierState =>
    actions.reduce<ModifierState>(applyShortcut, NO_MODIFIERS);

  it('starts with nothing held', () => {
    expect(NO_MODIFIERS).toEqual({ lockAxis: false, suspendSnap: false, panOverride: false });
  });

  it('holds each of the three, one at a time', () => {
    const held: Readonly<Record<ToolModifier, ModifierState>> = {
      lockAxis: { ...NO_MODIFIERS, lockAxis: true },
      suspendSnap: { ...NO_MODIFIERS, suspendSnap: true },
      panOverride: { ...NO_MODIFIERS, panOverride: true },
    };

    for (const shortcut of MODIFIER_SHORTCUTS) {
      expect(fold([{ kind: 'holdModifier', modifier: shortcut.modifier }])).toEqual(
        held[shortcut.modifier],
      );
    }
  });

  it('holds two at once and lets one go without disturbing the other', () => {
    const both = fold([
      { kind: 'holdModifier', modifier: 'lockAxis' },
      { kind: 'holdModifier', modifier: 'suspendSnap' },
    ]);

    expect(both).toEqual({ lockAxis: true, suspendSnap: true, panOverride: false });
    expect(applyShortcut(both, { kind: 'releaseModifier', modifier: 'suspendSnap' })).toEqual({
      lockAxis: true,
      suspendSnap: false,
      panOverride: false,
    });
  });

  it('keeps a held key across a tool change', () => {
    const held = fold([{ kind: 'holdModifier', modifier: 'lockAxis' }]);

    expect(applyShortcut(held, { kind: 'activateTool', tool: 'drawWall' })).toBe(held);
  });

  it('lets go of something never held without complaining', () => {
    expect(applyShortcut(NO_MODIFIERS, { kind: 'releaseModifier', modifier: 'panOverride' })).toEqual(
      NO_MODIFIERS,
    );
  });

  it('drops everything when the window stops listening', () => {
    expect(clearModifiers()).toEqual(NO_MODIFIERS);
  });
});

/* -------------------------------------------------------------------------- */
/* The generated table.                                                        */
/* -------------------------------------------------------------------------- */

describe('the lookup table', () => {
  it('has one row per binding, in two sections', () => {
    expect(SHORTCUT_TABLE.map((section) => section.id)).toEqual(['tools', 'modifiers']);
    expect(SHORTCUT_TABLE.map((section) => section.title)).toEqual([
      SHORTCUT_SECTION_LABELS.tools,
      SHORTCUT_SECTION_LABELS.modifiers,
    ]);
    expect(shortcutRows()).toHaveLength(11);
  });

  it('takes every tool row from the tool itself rather than restating it', () => {
    const [tools] = SHORTCUT_TABLE;

    expect(tools?.rows.map((row) => row.subject)).toEqual(
      TOOL_IDS.map((tool) => ({ kind: 'tool', tool })),
    );

    for (const tool of TOOL_IDS) {
      const row = shortcutRowFor(TOOL_SHORTCUTS[tool]);

      expect(`${tool}:${row?.action ?? ''}`).toBe(`${tool}:${TOOLS[tool].label}`);
      expect(`${tool}:${row?.description ?? ''}`).toBe(`${tool}:${TOOLS[tool].description}`);
      expect(row?.id).toBe(`tool.${tool}`);
    }
  });

  it('takes every modifier row from the modifier declaration', () => {
    for (const shortcut of MODIFIER_SHORTCUTS) {
      const row = shortcutRowFor(shortcut.code);

      expect(row?.id).toBe(`modifier.${shortcut.modifier}`);
      expect(row?.keyLabel).toBe(shortcut.keyLabel);
      expect(row?.action).toBe(shortcut.label);
      expect(row?.description).toBe(shortcut.description);
    }
  });

  it('lists the tools in the order the toolbar lists them', () => {
    const [tools] = SHORTCUT_TABLE;

    expect(tools?.rows.map((row) => row.keyLabel)).toEqual(
      TOOL_IDS.map((tool) => TOOL_SHORTCUTS[tool]),
    );
  });

  it('gives every row a key the resolver actually answers to', () => {
    for (const row of shortcutRows()) {
      const key = row.code === 'SPACE' ? ' ' : row.code;

      expect(`${row.id}:${String(resolveKeyDown({ key }, CANVAS) === null)}`).toBe(
        `${row.id}:false`,
      );
    }
  });

  it('finds nothing for a key nobody was given', () => {
    expect(shortcutRowFor('Q')).toBeNull();
  });

  it('rebuilds itself from whatever registry it is handed', () => {
    const rebuilt = buildShortcutTable(TOOLS);

    expect(rebuilt).toEqual(SHORTCUT_TABLE);
  });

  it('prints the eleven shortcuts and matches the brief', () => {
    const printed = shortcutRows().map((row) => ({
      key: row.keyLabel,
      action: row.action,
      description: row.description,
    }));

    console.table(printed);

    expect(printed.map((row) => row.key)).toEqual([
      'V',
      'H',
      'W',
      'D',
      'F',
      'M',
      'X',
      'G',
      'Shift',
      'Alt',
      'Phím cách',
    ]);
  });
});
