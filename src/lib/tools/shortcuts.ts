/**
 * The keyboard, declared once.
 *
 * A CAD engineer works with the left hand on the keyboard and the right on the
 * pointer, so a key that does the wrong thing costs more than a button that
 * looks wrong. Four rules hold, and each is checked rather than trusted:
 *
 * - **One key, one meaning.** The bindings are two tables and nothing else, and
 *   `shortcutConflicts` reads them for a key bound twice, a tool key that is
 *   also a modifier, or a binding that steals a key the interface needs. A
 *   conflict is a test failure, not a bug report from a user.
 * - **Nothing fires while somebody is typing.** Every key-down is refused when
 *   the focus is in a field, so `W` in a room name types a `W`. This is checked
 *   on the target the caller passes, not on a global — see `isTextEntryTarget`.
 * - **Nothing is registered here.** This module declares and resolves; it never
 *   touches `window`, `document` or any listener. The shell attaches one
 *   listener and asks this module what the key meant, which is what lets the
 *   whole keyboard be tested without a DOM.
 * - **A modifier is not a tool.** `Space` reads as "pan for as long as I hold
 *   it", and it deliberately does **not** activate the pan tool: activating a
 *   tool cancels the gesture in flight (`reduceTool`), so a nudge of the view
 *   half-way through a wall would throw the wall away. Held keys set flags the
 *   active tool reads; they never change which tool is active.
 *
 * The resolver answers a `ShortcutAction`, never a `ToolEvent`: turning
 * `activateTool` into `{ type: 'activate', tool }` is the coordinator's step, so
 * the keyboard stays one table and one lookup.
 */

import type { ToolId } from './toolMachine';
import { TOOL_IDS } from './toolMachine';

/* -------------------------------------------------------------------------- */
/* Key codes.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A key as this module names it: `KeyboardEvent.key`, upper-cased, with the
 * space bar spelled out.
 *
 * Upper case so `v` and `V` are one binding — the engineer holding Shift to
 * lock an axis must still be able to reach for a tool. The space bar arrives as
 * `' '` from the browser and as `'Spacebar'` from older ones; both become
 * `SPACE`, so a binding table never contains an invisible character.
 */
export type ShortcutCode = string;

/** The code a raw `KeyboardEvent.key` maps onto. */
export const normaliseKey = (key: string): ShortcutCode => {
  if (key === ' ' || key === 'Spacebar') {
    return 'SPACE';
  }

  return key.toUpperCase();
};

/**
 * Keys no binding may take.
 *
 * `ESCAPE` closes the top layer and cancels the gesture in flight, `ENTER`
 * confirms it, and `TAB` is how the whole interface is reached without a mouse
 * (invariant A12). Binding a tool to any of the three would break a promise the
 * product makes everywhere, so `shortcutConflicts` refuses it here rather than
 * leaving it to a review.
 */
export const RESERVED_KEYS: readonly ShortcutCode[] = ['ESCAPE', 'ENTER', 'TAB'];

/* -------------------------------------------------------------------------- */
/* The eight tool keys.                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A key per tool, chosen the way the trade already reads them.
 *
 * `V` and `H` are the two every drawing package agrees on — pick and hand — and
 * the other six are the first letter of what they do: wall, door, furniture,
 * measure, and cut, with `G` for a note because `N` reads as "new". A complete
 * record, so a ninth tool fails the build here instead of shipping unreachable
 * from the keyboard.
 */
export const TOOL_SHORTCUTS: Readonly<Record<ToolId, ShortcutCode>> = {
  select: 'V',
  pan: 'H',
  drawWall: 'W',
  placeOpening: 'D',
  placeFurniture: 'F',
  measure: 'M',
  splitWall: 'X',
  annotate: 'G',
};

/* -------------------------------------------------------------------------- */
/* The three modifiers.                                                        */
/* -------------------------------------------------------------------------- */

/** What a held key does to the tool already in hand. */
export type ToolModifier = 'lockAxis' | 'suspendSnap' | 'panOverride';

/** One held key, with the words the help screen shows for it. */
export interface ModifierShortcut {
  readonly modifier: ToolModifier;
  readonly code: ShortcutCode;
  /**
   * The key as it is printed on a key cap.
   *
   * Upper case letters and capitalised key names are the exception invariant A6
   * allows alongside axis codes: a key cap is the name of a physical thing, and
   * writing it in sentence case would stop it looking like the key.
   */
  readonly keyLabel: string;
  /** Vietnamese name, lower case sentence style. */
  readonly label: string;
  /** One Vietnamese sentence saying what holding it does. */
  readonly description: string;
}

/**
 * The three keys that change what the active tool does while they are held.
 *
 * All three are held rather than pressed, which is the whole distinction: they
 * modify a gesture in progress and are released back, so neither one ever
 * appears as a tool in the toolbar and none of them cancels a draft.
 */
export const MODIFIER_SHORTCUTS: readonly ModifierShortcut[] = [
  {
    modifier: 'lockAxis',
    code: 'SHIFT',
    keyLabel: 'Shift',
    label: 'khoá phương',
    description: 'Giữ Shift để khoá điểm đang vẽ theo phương ngang hoặc phương đứng.',
  },
  {
    modifier: 'suspendSnap',
    code: 'ALT',
    keyLabel: 'Alt',
    label: 'tạm tắt bắt điểm',
    description: 'Giữ Alt để tạm tắt bắt điểm, đặt toạ độ đúng chỗ con trỏ đang chỉ.',
  },
  {
    modifier: 'panOverride',
    code: 'SPACE',
    keyLabel: 'Phím cách',
    label: 'tạm chuyển sang di chuyển khung nhìn',
    description:
      'Giữ phím cách để tạm dời khung nhìn; thả ra là quay lại công cụ đang dùng, bản nháp còn nguyên.',
  },
];

/* -------------------------------------------------------------------------- */
/* Lookups.                                                                    */
/* -------------------------------------------------------------------------- */

const TOOL_BY_CODE: ReadonlyMap<ShortcutCode, ToolId> = new Map(
  TOOL_IDS.map((tool) => [TOOL_SHORTCUTS[tool], tool] as const),
);

const MODIFIER_BY_CODE: ReadonlyMap<ShortcutCode, ModifierShortcut> = new Map(
  MODIFIER_SHORTCUTS.map((shortcut) => [shortcut.code, shortcut] as const),
);

/** The key that reaches a tool. */
export const shortcutForTool = (tool: ToolId): ShortcutCode => TOOL_SHORTCUTS[tool];

/** The tool a key reaches, or `null` when it reaches none. */
export const toolForShortcut = (code: ShortcutCode): ToolId | null =>
  TOOL_BY_CODE.get(normaliseKey(code)) ?? null;

/** The modifier a key holds, or `null` when it holds none. */
export const modifierForShortcut = (code: ShortcutCode): ModifierShortcut | null =>
  MODIFIER_BY_CODE.get(normaliseKey(code)) ?? null;

/* -------------------------------------------------------------------------- */
/* Where the focus is.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The part of a focused element this module needs to see.
 *
 * A structural shape rather than `HTMLElement`, for two reasons: a test can
 * describe a focused field in one object literal, and a real element satisfies
 * it as it is, so the caller passes `event.target as HTMLElement | null`
 * without building anything.
 */
export interface ShortcutTarget {
  readonly tagName: string;
  readonly isContentEditable?: boolean;
}

/** Elements that swallow every printable key while they hold the focus. */
const TEXT_ENTRY_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Is somebody typing?
 *
 * Every `<input>` counts, not only the text ones: a checkbox answers the space
 * bar and a `<select>` answers the letters, and stealing either would break the
 * keyboard-only path invariant A12 promises. A `<select>` is included for the
 * same reason. Anything the browser reports as editable content counts too.
 */
export const isTextEntryTarget = (target: ShortcutTarget | null | undefined): boolean => {
  if (target === null || target === undefined) {
    return false;
  }

  if (target.isContentEditable === true) {
    return true;
  }

  return TEXT_ENTRY_TAGS.has(target.tagName.toUpperCase());
};

/* -------------------------------------------------------------------------- */
/* Resolving a key press.                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A key press, as much of it as this module reads.
 *
 * Every flag is optional and reads as `false` when absent, which is what makes
 * a real `KeyboardEvent` a valid argument and a test fixture one line long.
 */
export interface ShortcutInput {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  /** True while a key auto-repeats; a repeat is not a second press. */
  readonly repeat?: boolean;
}

/** What a key press meant. */
export type ShortcutAction =
  | { readonly kind: 'activateTool'; readonly tool: ToolId }
  | { readonly kind: 'holdModifier'; readonly modifier: ToolModifier }
  | { readonly kind: 'releaseModifier'; readonly modifier: ToolModifier };

/**
 * What a key press means, or `null` when it means nothing here.
 *
 * Refused in four cases, in this order: an auto-repeat, a focus in a field, a
 * chord with Ctrl or Cmd — those belong to the shell and to the browser — and a
 * letter pressed with Alt down, because Alt is already the snapping modifier
 * and `Alt+W` is a menu on half the desktops in the world.
 */
export function resolveKeyDown(
  input: ShortcutInput,
  target: ShortcutTarget | null,
): ShortcutAction | null {
  if (input.repeat === true || isTextEntryTarget(target)) {
    return null;
  }

  if (input.ctrlKey === true || input.metaKey === true) {
    return null;
  }

  const code = normaliseKey(input.key);
  const modifier = MODIFIER_BY_CODE.get(code);

  if (modifier !== undefined) {
    return { kind: 'holdModifier', modifier: modifier.modifier };
  }

  if (input.altKey === true) {
    return null;
  }

  const tool = TOOL_BY_CODE.get(code);

  return tool === undefined ? null : { kind: 'activateTool', tool };
}

/**
 * What letting a key go means, or `null` when it means nothing here.
 *
 * Deliberately blind to where the focus is. A modifier held before the focus
 * moved into a field would otherwise never be released, and the drawing would
 * stay axis-locked with nothing on screen saying why. Releasing something that
 * was never held is a no-op in `applyShortcut`, so the blind release is the safe
 * one.
 */
export function resolveKeyUp(input: ShortcutInput): ShortcutAction | null {
  const modifier = MODIFIER_BY_CODE.get(normaliseKey(input.key));

  return modifier === undefined ? null : { kind: 'releaseModifier', modifier: modifier.modifier };
}

/* -------------------------------------------------------------------------- */
/* The held keys.                                                              */
/* -------------------------------------------------------------------------- */

/** Which modifiers are down right now. */
export interface ModifierState {
  readonly lockAxis: boolean;
  readonly suspendSnap: boolean;
  readonly panOverride: boolean;
}

/** Nothing held. Also what the shell resets to when the window loses focus. */
export const NO_MODIFIERS: ModifierState = {
  lockAxis: false,
  suspendSnap: false,
  panOverride: false,
};

const withModifier = (
  state: ModifierState,
  modifier: ToolModifier,
  held: boolean,
): ModifierState => {
  switch (modifier) {
    case 'lockAxis':
      return { ...state, lockAxis: held };
    case 'suspendSnap':
      return { ...state, suspendSnap: held };
    case 'panOverride':
      return { ...state, panOverride: held };
  }
};

/**
 * Folds one action into the held-key state.
 *
 * `activateTool` leaves it alone: which tool is in hand is the tool machine's
 * business, and a modifier survives a tool change the same way a physical key
 * stays down when the other hand moves.
 */
export const applyShortcut = (state: ModifierState, action: ShortcutAction): ModifierState => {
  switch (action.kind) {
    case 'activateTool':
      return state;
    case 'holdModifier':
      return withModifier(state, action.modifier, true);
    case 'releaseModifier':
      return withModifier(state, action.modifier, false);
  }
};

/**
 * Everything let go at once.
 *
 * The shell calls this when the window loses focus or the focus enters a field,
 * because the key-up for a key released outside the page never arrives and a
 * modifier stuck down is worse than one released early.
 */
export const clearModifiers = (): ModifierState => NO_MODIFIERS;

/* -------------------------------------------------------------------------- */
/* Checking the table.                                                         */
/* -------------------------------------------------------------------------- */

/** One key that more than one thing wants, or one nothing may have. */
export interface ShortcutConflict {
  readonly code: ShortcutCode;
  /** Everything bound to the key, in English, for the failure message. */
  readonly boundTo: readonly string[];
  /** Vietnamese sentence naming the problem. */
  readonly reason: string;
}

/** A whole keyboard, so the check can be run against a proposed one as well. */
export interface ShortcutBindings {
  readonly tools: Readonly<Record<ToolId, ShortcutCode>>;
  readonly modifiers: readonly ModifierShortcut[];
  readonly reserved: readonly ShortcutCode[];
}

/** The keyboard this build ships. */
export const SHORTCUT_BINDINGS: ShortcutBindings = {
  tools: TOOL_SHORTCUTS,
  modifiers: MODIFIER_SHORTCUTS,
  reserved: RESERVED_KEYS,
};

/**
 * Every key bound twice, and every binding that took a reserved key.
 *
 * Read from the tables at runtime rather than asserted once in a test, so the
 * check is available to the shell as well: a build that somehow shipped a clash
 * can say so instead of quietly giving one key to two tools. Taking the
 * bindings as an argument is what lets a test prove the check actually catches
 * a clash, rather than only that today's table has none.
 */
export function shortcutConflicts(
  bindings: ShortcutBindings = SHORTCUT_BINDINGS,
): readonly ShortcutConflict[] {
  const owners = new Map<ShortcutCode, string[]>();

  const claim = (code: ShortcutCode, owner: string): void => {
    const existing = owners.get(code);

    if (existing === undefined) {
      owners.set(code, [owner]);

      return;
    }

    existing.push(owner);
  };

  for (const tool of TOOL_IDS) {
    claim(normaliseKey(bindings.tools[tool]), `tool:${tool}`);
  }

  for (const shortcut of bindings.modifiers) {
    claim(normaliseKey(shortcut.code), `modifier:${shortcut.modifier}`);
  }

  const conflicts: ShortcutConflict[] = [];
  const reserved = new Set(bindings.reserved.map((code) => normaliseKey(code)));

  for (const [code, boundTo] of owners) {
    if (boundTo.length > 1) {
      conflicts.push({
        code,
        boundTo,
        reason: `Phím ${code} đang được gán cho ${boundTo.length} chức năng.`,
      });

      continue;
    }

    if (reserved.has(code)) {
      conflicts.push({
        code,
        boundTo,
        reason: `Phím ${code} dành cho giao diện nên không được gán cho công cụ.`,
      });
    }
  }

  return conflicts;
}
