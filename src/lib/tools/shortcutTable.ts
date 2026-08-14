/**
 * The lookup table the help screen shows, generated from the bindings.
 *
 * Nothing here restates a key, a name or a sentence. A tool row's key comes
 * from `TOOL_SHORTCUTS`, its name and its explanation come from the tool's own
 * definition in `tools.ts`, and a modifier row is the modifier's own
 * declaration read back. There is therefore no second copy of the keyboard to
 * drift out of step with the first: rename a tool and the help screen renames
 * itself, add a tool without a key and the build fails at `TOOL_SHORTCUTS`.
 *
 * The rows are plain data with no markup and no token in them, because a help
 * screen, a printed sheet and a tooltip all want the same eleven facts in
 * different clothes. Which is also why the table is built from the registry it
 * is given rather than reaching for the module-level one: a screen showing a
 * reduced toolbar passes its own.
 */

import { TOOLS } from './tools';
import type { ToolId, ToolRegistry } from './toolMachine';
import { TOOL_IDS } from './toolMachine';
import {
  MODIFIER_SHORTCUTS,
  normaliseKey,
  TOOL_SHORTCUTS,
  type ShortcutCode,
  type ToolModifier,
} from './shortcuts';

/* -------------------------------------------------------------------------- */
/* Rows and sections.                                                          */
/* -------------------------------------------------------------------------- */

/** The two halves of the keyboard: a key that picks, a key that is held. */
export type ShortcutSectionId = 'tools' | 'modifiers';

/**
 * Vietnamese heading per section, lower case sentence style (invariant A6).
 *
 * A complete record, so a third section fails the build here rather than
 * appearing under an empty heading.
 */
export const SHORTCUT_SECTION_LABELS: Readonly<Record<ShortcutSectionId, string>> = {
  tools: 'công cụ',
  modifiers: 'phím bổ trợ',
};

/** What a row is about, so a screen can highlight the tool in hand. */
export type ShortcutSubject =
  | { readonly kind: 'tool'; readonly tool: ToolId }
  | { readonly kind: 'modifier'; readonly modifier: ToolModifier };

/** One line of the lookup table. */
export interface ShortcutRow {
  /** Technical id, stable across renames, for keys and for tests. */
  readonly id: string;
  /** The normalised code the resolver matches on. */
  readonly code: ShortcutCode;
  /** The key as printed on a key cap: `W`, `Shift`, `Phím cách`. */
  readonly keyLabel: string;
  /** Vietnamese name of what the key does, lower case sentence style. */
  readonly action: string;
  /** One Vietnamese sentence explaining it. */
  readonly description: string;
  readonly subject: ShortcutSubject;
}

/** One block of the lookup table. */
export interface ShortcutSection {
  readonly id: ShortcutSectionId;
  readonly title: string;
  readonly rows: readonly ShortcutRow[];
}

/* -------------------------------------------------------------------------- */
/* Building it.                                                                */
/* -------------------------------------------------------------------------- */

/** One tool's row, with every word taken from the tool's own definition. */
const rowForTool = (tool: ToolId, tools: ToolRegistry): ShortcutRow => {
  const definition = tools[tool];
  const code = normaliseKey(TOOL_SHORTCUTS[tool]);

  return {
    id: `tool.${tool}`,
    code,
    keyLabel: code,
    action: definition.label,
    description: definition.description,
    subject: { kind: 'tool', tool },
  };
};

/**
 * The whole lookup table, in the order the toolbar and the keyboard read.
 *
 * Tools first in `TOOL_IDS` order, so the help screen and the toolbar list the
 * same eight things in the same order; then the held keys, in the order they
 * are declared.
 */
export function buildShortcutTable(tools: ToolRegistry = TOOLS): readonly ShortcutSection[] {
  return [
    {
      id: 'tools',
      title: SHORTCUT_SECTION_LABELS.tools,
      rows: TOOL_IDS.map((tool) => rowForTool(tool, tools)),
    },
    {
      id: 'modifiers',
      title: SHORTCUT_SECTION_LABELS.modifiers,
      rows: MODIFIER_SHORTCUTS.map((shortcut) => ({
        id: `modifier.${shortcut.modifier}`,
        code: normaliseKey(shortcut.code),
        keyLabel: shortcut.keyLabel,
        action: shortcut.label,
        description: shortcut.description,
        subject: { kind: 'modifier', modifier: shortcut.modifier },
      })),
    },
  ];
}

/** The table for the shipped toolbar, built once. */
export const SHORTCUT_TABLE: readonly ShortcutSection[] = buildShortcutTable();

/* -------------------------------------------------------------------------- */
/* Reading it.                                                                 */
/* -------------------------------------------------------------------------- */

/** Every row of every section, flattened, in table order. */
export const shortcutRows = (
  table: readonly ShortcutSection[] = SHORTCUT_TABLE,
): readonly ShortcutRow[] => table.flatMap((section) => section.rows);

/** The row a key belongs to, or `null` when the key is bound to nothing. */
export const shortcutRowFor = (
  code: ShortcutCode,
  table: readonly ShortcutSection[] = SHORTCUT_TABLE,
): ShortcutRow | null => {
  const wanted = normaliseKey(code);

  return shortcutRows(table).find((row) => row.code === wanted) ?? null;
};
