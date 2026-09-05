/**
 * The arbiter every shortcut answers to.
 *
 * Dozens of keys live on four floors — dialog, side panel, canvas, global —
 * and without one referee two floors will quietly claim the same key. This
 * module is that referee, and four rules hold:
 *
 * - **One listener.** Nothing else in the codebase may call
 *   `window.addEventListener('keydown', …)`. The shell attaches this registry
 *   once through `attach`, and every binding — a dialog's Enter, the canvas
 *   tools, Ctrl+Z — arrives here to be arbitrated. A second attach is refused
 *   with a warning, because two listeners is exactly the bug this module
 *   exists to prevent.
 * - **The upper floor answers first.** Resolution walks
 *   `SCOPE_PRIORITY` from dialog down to global and stops at the first match.
 *   A dialog is *modal*: while one is open (a binding registered in the
 *   `dialog` scope, or the scope claimed via `claimScope`), every key the
 *   dialog does not bind is swallowed rather than passed down — `W` must not
 *   change the canvas tool behind an open dialog. The one exception is
 *   Escape, which always falls through to the global close-top-layer handler,
 *   because "Esc đóng lớp trên cùng" (invariant A12) is a promise no dialog
 *   may break by forgetting a binding.
 * - **Nothing fires while somebody is typing.** Reuses `isTextEntryTarget`
 *   from the tool keyboard: focus in an input, textarea, select or editable
 *   content disables every binding, chords included, so Ctrl+Z in a room-name
 *   field stays the browser's own undo.
 * - **Ctrl is Cmd.** A combo written `Ctrl+Z` matches the Control key on
 *   Windows and the Command key on a Mac; the parsed form calls both `mod`.
 *
 * The registry never reads module state of the tool keyboard and the tool
 * keyboard never reads this: the shell registers tool activation as ordinary
 * `canvas`-scope bindings, so the whole arbitration is one table walked in
 * one order.
 *
 * Overlaps are a build-time smell caught at run time: registering a combo
 * already taken in the same scope warns immediately in development, naming
 * both registrants, and `reportOverlaps` re-runs the audit at startup so a
 * clash between two far-apart mounts still surfaces with both names in it.
 */

import {
  isTextEntryTarget,
  normaliseKey,
  type ShortcutCode,
  type ShortcutTarget,
} from '../tools/shortcuts';

/* -------------------------------------------------------------------------- */
/* Scopes.                                                                     */
/* -------------------------------------------------------------------------- */

/** The four floors a binding can live on. */
export type ShortcutScope = 'dialog' | 'sidePanel' | 'canvas' | 'global';

/**
 * Resolution order, highest first. A key press is offered to each scope in
 * this order and the first scope that answers keeps it.
 */
export const SCOPE_PRIORITY: readonly ShortcutScope[] = [
  'dialog',
  'sidePanel',
  'canvas',
  'global',
];

/**
 * Scopes that swallow every key they do not bind while they are active.
 * Only the dialog floor is modal: a side panel coexists with the canvas, an
 * open dialog does not.
 */
const MODAL_SCOPES: ReadonlySet<ShortcutScope> = new Set<ShortcutScope>(['dialog']);

/* -------------------------------------------------------------------------- */
/* Combos.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A combo taken apart. `mod` is the platform primary modifier: it matches
 * the Control key *or* the Command key, which is what lets one table serve
 * both keyboards.
 */
export interface ParsedCombo {
  readonly code: ShortcutCode;
  readonly mod: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

/** Every spelling of a modifier a combo may use, and what it means here. */
const MODIFIER_TOKENS: Readonly<Record<string, 'mod' | 'alt' | 'shift'>> = {
  ctrl: 'mod',
  control: 'mod',
  cmd: 'mod',
  command: 'mod',
  meta: 'mod',
  mod: 'mod',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
};

/**
 * Reads a combo like `'Ctrl+Shift+Z'`, `'?'` or `'Escape'`.
 *
 * Throws on a combo with no main key or with two, because a malformed combo
 * is a programming error and silently binding nothing would hide it. Tab is
 * refused outright: Tab is how the whole interface is reached without a
 * mouse (invariant A12) and no feature may take it.
 */
export function parseCombo(combo: string): ParsedCombo {
  const tokens = combo
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  let mod = false;
  let alt = false;
  let shift = false;
  let code: ShortcutCode | null = null;

  for (const token of tokens) {
    const modifier = MODIFIER_TOKENS[token.toLowerCase()];

    if (modifier === 'mod') {
      mod = true;
      continue;
    }

    if (modifier === 'alt') {
      alt = true;
      continue;
    }

    if (modifier === 'shift') {
      shift = true;
      continue;
    }

    if (code !== null) {
      throw new Error(`Tổ hợp phím "${combo}" có nhiều hơn một phím chính.`);
    }

    code = normaliseKey(token);
  }

  if (code === null) {
    throw new Error(`Tổ hợp phím "${combo}" không có phím chính.`);
  }

  if (code === 'TAB') {
    throw new Error(
      'Không được gán phím tắt cho Tab: Tab là đường di chuyển bằng bàn phím (bất biến A12).',
    );
  }

  return { code, mod, alt, shift };
}

/** The one spelling a parsed combo prints back as: `Mod+Shift+Z`, `?`. */
export function formatCombo(parsed: ParsedCombo): string {
  const parts: string[] = [];

  if (parsed.mod) {
    parts.push('Mod');
  }

  if (parsed.alt) {
    parts.push('Alt');
  }

  if (parsed.shift) {
    parts.push('Shift');
  }

  parts.push(parsed.code);

  return parts.join('+');
}

/* -------------------------------------------------------------------------- */
/* Events and definitions.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A key press, as much of it as the registry reads. A real `KeyboardEvent`
 * satisfies this as it is; a test fixture is one object literal.
 */
export interface ShortcutKeyEvent {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  /** True while a key auto-repeats; a repeat is not a second press. */
  readonly repeat?: boolean;
  preventDefault?(): void;
}

/** One binding, declared by the component that owns the behaviour. */
export interface ShortcutDefinition {
  /**
   * Technical id, unique per registration site — `'global.undo'`,
   * `'dialog.deleteFloor.confirm'`. This is the name an overlap warning
   * prints, so it must say *where* the binding lives, not just what it does.
   */
  readonly id: string;
  /** E.g. `'Ctrl+Shift+Z'`, `'?'`, `'Escape'`. `Ctrl` also matches Cmd. */
  readonly combo: string;
  readonly scope: ShortcutScope;
  /** Vietnamese sentence for the help screen, lower case sentence style. */
  readonly description?: string;
  /** Fires on auto-repeat as well. Default: one press, one call. */
  readonly allowRepeat?: boolean;
  /** The registry calls `preventDefault()` on a match unless this is false. */
  readonly preventDefault?: boolean;
  onTrigger(event: ShortcutKeyEvent): void;
}

/** One key two registrants both want, with both their names. */
export interface ShortcutOverlap {
  readonly scope: ShortcutScope;
  /** Canonical spelling, so `Ctrl+Z` and `Cmd+Z` report as one key. */
  readonly combo: string;
  readonly registrantIds: readonly string[];
}

/** One binding exactly as it stands registered right now. */
export interface RegisteredShortcut {
  readonly id: string;
  /** Canonical spelling, e.g. `Mod+Shift+Z` — the same form `formatCombo` prints. */
  readonly combo: string;
  readonly scope: ShortcutScope;
  readonly description?: string;
}

/**
 * The one place a real listener is allowed to exist. `window` satisfies
 * this; a test passes a recording fake.
 */
export interface ShortcutListenerTarget {
  addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
}

export interface ShortcutRegistry {
  /** Adds a binding; the returned function removes it. */
  register(definition: ShortcutDefinition): () => void;
  /**
   * Marks a scope as present without binding a key — a dialog with no
   * shortcuts of its own still claims the `dialog` scope so its modality
   * holds. The returned function releases the claim.
   */
  claimScope(scope: ShortcutScope): () => void;
  /**
   * Arbitrates one key press. Returns true when a binding answered it.
   * Exposed so a test — or a rendering layer with its own event plumbing —
   * can feed the registry without a DOM.
   */
  handleKeyDown(event: ShortcutKeyEvent, target: ShortcutTarget | null): boolean;
  /**
   * Attaches the single keydown listener. Refuses a second attach with a
   * warning while one is live; the returned function detaches.
   */
  attach(target: ShortcutListenerTarget): () => void;
  /** Every combo registered more than once in one scope, with all names. */
  findOverlaps(): readonly ShortcutOverlap[];
  /**
   * The startup audit: finds every overlap and, in development, warns once
   * per doubled key naming both registration sites. Returns what it found so
   * the caller can assert on it.
   */
  reportOverlaps(): readonly ShortcutOverlap[];
  /**
   * Every binding registered at this instant, canonical combo included — the
   * one source a shortcut-help overlay reads from instead of a handwritten
   * list that would drift. Registration order, not display order: a caller
   * that cares about grouping or priority sorts this itself.
   */
  listShortcuts(): readonly RegisteredShortcut[];
}

export interface ShortcutRegistryOptions {
  /** Overlap warnings fire only when true. Defaults to the Vite dev flag. */
  readonly isDev?: boolean;
  /** Where a warning goes. Defaults to `console.warn`. */
  warn?(message: string): void;
}

/* -------------------------------------------------------------------------- */
/* Matching.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Keys that are only ever modifiers. A keydown for one of these is never a
 * shortcut on its own, so it is refused before any table is walked.
 */
const MODIFIER_KEY_CODES: ReadonlySet<ShortcutCode> = new Set([
  'SHIFT',
  'CONTROL',
  'ALT',
  'META',
  'OS',
]);

/**
 * Whether Shift may be ignored when matching this combo.
 *
 * `?` arrives from the browser with `shiftKey` down because Shift is how the
 * character is typed, so a combo written `'?'` must match anyway. Letters
 * stay strict — `Ctrl+Z` and `Ctrl+Shift+Z` are two different commands — so
 * the leniency is limited to a combo that names a non-letter character and
 * does not itself ask for Shift.
 */
const isShiftAgnostic = (parsed: ParsedCombo): boolean =>
  !parsed.shift &&
  parsed.code.length === 1 &&
  parsed.code.toLowerCase() === parsed.code.toUpperCase();

const eventMatches = (parsed: ParsedCombo, event: ShortcutKeyEvent): boolean => {
  if (normaliseKey(event.key) !== parsed.code) {
    return false;
  }

  const mod = event.ctrlKey === true || event.metaKey === true;

  if (mod !== parsed.mod) {
    return false;
  }

  if ((event.altKey === true) !== parsed.alt) {
    return false;
  }

  if (!isShiftAgnostic(parsed) && (event.shiftKey === true) !== parsed.shift) {
    return false;
  }

  return true;
};

/** The focused element as `isTextEntryTarget` wants it, or null. */
const targetOf = (event: KeyboardEvent): ShortcutTarget | null => {
  const candidate = event.target as { tagName?: unknown } | null | undefined;

  if (typeof candidate?.tagName !== 'string') {
    return null;
  }

  return candidate as unknown as ShortcutTarget;
};

/**
 * The default development flag, read the way `src/store/devtools.ts` reads
 * it: warnings are for a person at a dev server, not for the test runner's
 * output.
 */
const DEFAULT_DEV_FLAG: boolean =
  import.meta.env.DEV === true && import.meta.env.MODE !== 'test';

/* -------------------------------------------------------------------------- */
/* The registry.                                                               */
/* -------------------------------------------------------------------------- */

interface RegistryEntry {
  readonly definition: ShortcutDefinition;
  readonly parsed: ParsedCombo;
  readonly canonical: string;
}

export function createShortcutRegistry(
  options: ShortcutRegistryOptions = {},
): ShortcutRegistry {
  const isDev = options.isDev ?? DEFAULT_DEV_FLAG;
  const warn =
    options.warn ??
    ((message: string): void => {
      console.warn(message);
    });

  /**
   * Insertion order, walked backwards per scope so the most recently mounted
   * registrant answers first — the component on top of the visual stack is
   * the one that registered last.
   */
  const entries: RegistryEntry[] = [];
  const claims = new Map<ShortcutScope, number>();
  let attached = false;

  const scopeIsActive = (scope: ShortcutScope): boolean =>
    (claims.get(scope) ?? 0) > 0 ||
    entries.some((entry) => entry.definition.scope === scope);

  const overlapMessage = (overlap: ShortcutOverlap): string => {
    const names = overlap.registrantIds.map((id) => `"${id}"`).join(' và ');

    return `Phím tắt "${overlap.combo}" trong phạm vi "${overlap.scope}" được đăng ký ở cả ${names}.`;
  };

  const register = (definition: ShortcutDefinition): (() => void) => {
    const parsed = parseCombo(definition.combo);
    const canonical = formatCombo(parsed);

    if (isDev) {
      const taken = entries.filter(
        (entry) =>
          entry.definition.scope === definition.scope && entry.canonical === canonical,
      );

      if (taken.length > 0) {
        warn(
          overlapMessage({
            scope: definition.scope,
            combo: canonical,
            registrantIds: [...taken.map((entry) => entry.definition.id), definition.id],
          }),
        );
      }
    }

    const entry: RegistryEntry = { definition, parsed, canonical };

    entries.push(entry);

    return (): void => {
      const index = entries.indexOf(entry);

      if (index >= 0) {
        entries.splice(index, 1);
      }
    };
  };

  const claimScope = (scope: ShortcutScope): (() => void) => {
    claims.set(scope, (claims.get(scope) ?? 0) + 1);

    let released = false;

    return (): void => {
      if (released) {
        return;
      }

      released = true;
      claims.set(scope, Math.max(0, (claims.get(scope) ?? 0) - 1));
    };
  };

  const handleKeyDown = (
    event: ShortcutKeyEvent,
    target: ShortcutTarget | null,
  ): boolean => {
    if (isTextEntryTarget(target)) {
      return false;
    }

    const code = normaliseKey(event.key);

    if (MODIFIER_KEY_CODES.has(code)) {
      return false;
    }

    for (const scope of SCOPE_PRIORITY) {
      if (!scopeIsActive(scope)) {
        continue;
      }

      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];

        if (entry === undefined || entry.definition.scope !== scope) {
          continue;
        }

        if (event.repeat === true && entry.definition.allowRepeat !== true) {
          continue;
        }

        if (!eventMatches(entry.parsed, event)) {
          continue;
        }

        if (entry.definition.preventDefault !== false) {
          event.preventDefault?.();
        }

        entry.definition.onTrigger(event);

        return true;
      }

      // A modal floor swallows what it does not bind — except Escape, which
      // must always reach the global close-top-layer handler (invariant A12).
      if (MODAL_SCOPES.has(scope) && code !== 'ESCAPE') {
        return false;
      }
    }

    return false;
  };

  const attach = (target: ShortcutListenerTarget): (() => void) => {
    if (attached) {
      warn(
        'shortcutRegistry đã có listener; chỉ được gắn một lần. Lần gắn thứ hai bị bỏ qua.',
      );

      return (): void => {};
    }

    attached = true;

    const listener = (event: KeyboardEvent): void => {
      handleKeyDown(event, targetOf(event));
    };

    target.addEventListener('keydown', listener);

    return (): void => {
      attached = false;
      target.removeEventListener('keydown', listener);
    };
  };

  const findOverlaps = (): readonly ShortcutOverlap[] => {
    const byKey = new Map<string, RegistryEntry[]>();

    for (const entry of entries) {
      const key = `${entry.definition.scope}::${entry.canonical}`;
      const existing = byKey.get(key);

      if (existing === undefined) {
        byKey.set(key, [entry]);
        continue;
      }

      existing.push(entry);
    }

    const overlaps: ShortcutOverlap[] = [];

    for (const group of byKey.values()) {
      const first = group[0];

      if (first === undefined || group.length < 2) {
        continue;
      }

      overlaps.push({
        scope: first.definition.scope,
        combo: first.canonical,
        registrantIds: group.map((entry) => entry.definition.id),
      });
    }

    return overlaps;
  };

  const reportOverlaps = (): readonly ShortcutOverlap[] => {
    const overlaps = findOverlaps();

    if (isDev) {
      for (const overlap of overlaps) {
        warn(overlapMessage(overlap));
      }
    }

    return overlaps;
  };

  const listShortcuts = (): readonly RegisteredShortcut[] =>
    entries.map((entry) => ({
      id: entry.definition.id,
      combo: entry.canonical,
      scope: entry.definition.scope,
      ...(entry.definition.description !== undefined
        ? { description: entry.definition.description }
        : {}),
    }));

  return {
    register,
    claimScope,
    handleKeyDown,
    attach,
    findOverlaps,
    reportOverlaps,
    listShortcuts,
  };
}

/* -------------------------------------------------------------------------- */
/* The global group.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What the six application-wide keys do. Behaviour is injected rather than
 * imported: this module may not know the store (rule 0.4), and a test hands
 * in six spies.
 */
export interface GlobalShortcutHandlers {
  undo(): void;
  redo(): void;
  /** Flush the autosave now; there is no save button (invariant A7). */
  save(): void;
  openSearch(): void;
  openShortcutHelp(): void;
  /** Close whatever is on top: dialog, panel, popover (invariant A12). */
  closeTopLayer(): void;
}

/**
 * The application-wide bindings, built around the handlers the shell owns.
 *
 * Escape leaves the browser default alone: closing the top layer must not
 * also cancel the browser's own Escape behaviour (leaving fullscreen,
 * stopping a page load). Undo and redo repeat while held, the way every
 * editor's do.
 */
export const buildGlobalShortcuts = (
  handlers: GlobalShortcutHandlers,
): readonly ShortcutDefinition[] => [
  {
    id: 'global.undo',
    combo: 'Ctrl+Z',
    scope: 'global',
    description: 'hoàn tác thao tác gần nhất',
    allowRepeat: true,
    onTrigger: (): void => {
      handlers.undo();
    },
  },
  {
    id: 'global.redo',
    combo: 'Ctrl+Shift+Z',
    scope: 'global',
    description: 'làm lại thao tác vừa hoàn tác',
    allowRepeat: true,
    onTrigger: (): void => {
      handlers.redo();
    },
  },
  {
    id: 'global.save',
    combo: 'Ctrl+S',
    scope: 'global',
    description: 'lưu ngay thay vì chờ tự lưu',
    onTrigger: (): void => {
      handlers.save();
    },
  },
  {
    id: 'global.search',
    combo: 'Ctrl+F',
    scope: 'global',
    description: 'mở tìm kiếm trong dự án',
    onTrigger: (): void => {
      handlers.openSearch();
    },
  },
  {
    id: 'global.shortcutHelp',
    combo: '?',
    scope: 'global',
    description: 'mở bảng phím tắt',
    onTrigger: (): void => {
      handlers.openShortcutHelp();
    },
  },
  {
    id: 'global.closeTopLayer',
    combo: 'Escape',
    scope: 'global',
    preventDefault: false,
    description: 'đóng lớp trên cùng',
    onTrigger: (): void => {
      handlers.closeTopLayer();
    },
  },
];

/**
 * Registers the whole global group on a registry; the returned function
 * removes every one of them.
 */
export const registerGlobalShortcuts = (
  registry: ShortcutRegistry,
  handlers: GlobalShortcutHandlers,
): (() => void) => {
  const disposers = buildGlobalShortcuts(handlers).map((definition) =>
    registry.register(definition),
  );

  return (): void => {
    for (const dispose of disposers) {
      dispose();
    }
  };
};

/* -------------------------------------------------------------------------- */
/* The application instance.                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The one registry the application shares. Components reach it through
 * `useShortcut` (src/hooks/useShortcut.ts); the shell attaches it to
 * `window` through `useShortcutListener`, and that attach is the only
 * keydown listener the application is allowed.
 */
export const appShortcutRegistry: ShortcutRegistry = createShortcutRegistry();
