/**
 * The React face of the shortcut registry.
 *
 * The registry itself (src/lib/input/shortcutRegistry.ts) is pure and knows
 * nothing about React — rule 0.4 keeps React out of src/lib — so this file
 * is where a component's lifetime becomes a binding's lifetime: register on
 * mount, unregister on unmount, and never let a stale closure answer a key.
 *
 * Nothing here — and nothing anywhere else — calls
 * `window.addEventListener('keydown', …)` directly. The one physical
 * listener goes through `registry.attach`, and this file leases it: every
 * hook that puts something into a registry holds a reference on the
 * window listener for that registry, the first holder attaches, the last
 * one out detaches. A dialog rendered alone in a test or a story therefore
 * has a working keyboard without any host component, and a full screen
 * with forty bindings still has exactly one listener.
 */

import { useEffect, useRef } from 'react';
import {
  appShortcutRegistry,
  buildGlobalShortcuts,
  type GlobalShortcutHandlers,
  type ShortcutDefinition,
  type ShortcutKeyEvent,
  type ShortcutRegistry,
  type ShortcutScope,
} from '../lib/input/shortcutRegistry';

/* -------------------------------------------------------------------------- */
/* The listener lease.                                                         */
/* -------------------------------------------------------------------------- */

interface ListenerLease {
  count: number;
  detach: () => void;
}

const listenerLeases = new WeakMap<ShortcutRegistry, ListenerLease>();

/**
 * Holds the registry's window listener alive. The first holder is the one
 * that actually attaches — `registry.attach` stays the single
 * `addEventListener` call site in the codebase — and the lease only
 * detaches when the last holder releases, so mounting and unmounting
 * dialogs never flickers the listener off underneath the rest of the app.
 */
const retainListener = (registry: ShortcutRegistry): (() => void) => {
  let lease = listenerLeases.get(registry);

  if (lease === undefined) {
    lease = { count: 0, detach: registry.attach(window) };
    listenerLeases.set(registry, lease);
  }

  lease.count += 1;

  const held = lease;
  let released = false;

  return (): void => {
    if (released) {
      return;
    }

    released = true;
    held.count -= 1;

    if (held.count === 0) {
      held.detach();
      listenerLeases.delete(registry);
    }
  };
};

export interface UseShortcutOptions {
  /** The registry to bind on. Defaults to the application's shared one. */
  readonly registry?: ShortcutRegistry;
  /** False suspends the binding without unmounting the component. */
  readonly enabled?: boolean;
}

/**
 * Declares one shortcut for as long as the calling component is mounted.
 *
 * The handler is kept in a ref, so a new closure every render neither
 * re-registers the binding nor lets an old render answer the key: the
 * registration lives as long as `id`, `combo` and `scope` stand still, and
 * the freshest handler always runs.
 */
export function useShortcut(
  definition: ShortcutDefinition,
  options: UseShortcutOptions = {},
): void {
  const registry = options.registry ?? appShortcutRegistry;
  const enabled = options.enabled ?? true;

  const onTriggerRef = useRef(definition.onTrigger);

  useEffect(() => {
    onTriggerRef.current = definition.onTrigger;
  });

  const { id, combo, scope, description, allowRepeat, preventDefault } = definition;

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const release = retainListener(registry);
    const unregister = registry.register({
      id,
      combo,
      scope,
      ...(description !== undefined ? { description } : {}),
      ...(allowRepeat !== undefined ? { allowRepeat } : {}),
      ...(preventDefault !== undefined ? { preventDefault } : {}),
      onTrigger: (event: ShortcutKeyEvent): void => {
        onTriggerRef.current(event);
      },
    });

    return (): void => {
      unregister();
      release();
    };
  }, [registry, enabled, id, combo, scope, description, allowRepeat, preventDefault]);
}

export interface UseShortcutScopeOptions {
  readonly registry?: ShortcutRegistry;
  /** False releases the claim without unmounting — a closed dialog. */
  readonly active?: boolean;
}

/**
 * Claims a scope for as long as the component is mounted and `active`.
 *
 * A dialog calls this even when it binds no key of its own: the claim is
 * what makes the dialog floor modal, so `W` behind the dialog stops
 * changing the canvas tool the moment the dialog opens.
 */
export function useShortcutScope(
  scope: ShortcutScope,
  options: UseShortcutScopeOptions = {},
): void {
  const registry = options.registry ?? appShortcutRegistry;
  const active = options.active ?? true;

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const release = retainListener(registry);
    const releaseClaim = registry.claimScope(scope);

    return (): void => {
      releaseClaim();
      release();
    };
  }, [registry, scope, active]);
}

/**
 * Installs the six application-wide keys: Ctrl+Z, Ctrl+Shift+Z, Ctrl+S,
 * Ctrl+F, `?` for the shortcut table, Escape for the top layer. The shell
 * calls this once with the handlers it owns; handlers are read through a
 * ref, so a re-render with fresh closures does not churn the registrations.
 */
export function useGlobalShortcuts(
  handlers: GlobalShortcutHandlers,
  options: Pick<UseShortcutOptions, 'registry'> = {},
): void {
  const registry = options.registry ?? appShortcutRegistry;

  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const definitions = buildGlobalShortcuts({
      undo: (): void => {
        handlersRef.current.undo();
      },
      redo: (): void => {
        handlersRef.current.redo();
      },
      save: (): void => {
        handlersRef.current.save();
      },
      openSearch: (): void => {
        handlersRef.current.openSearch();
      },
      openShortcutHelp: (): void => {
        handlersRef.current.openShortcutHelp();
      },
      closeTopLayer: (): void => {
        handlersRef.current.closeTopLayer();
      },
    });

    const release = retainListener(registry);
    const disposers = definitions.map((definition) => registry.register(definition));

    return (): void => {
      for (const dispose of disposers) {
        dispose();
      }

      release();
    };
  }, [registry]);
}

/**
 * Holds the window listener for as long as the shell is mounted and runs
 * the development-mode overlap audit, so two far-apart registrations of
 * one key are reported at startup with both names.
 *
 * The binding hooks lease the listener on their own, so this hook is not
 * required for the keyboard to work — it exists for the audit, and to keep
 * the listener alive across a moment where every binding happens to be
 * unmounted. Child effects run before a parent's, so by the time the
 * shell's effect audits, the screens mounted under it have registered.
 */
export function useShortcutListener(
  options: Pick<UseShortcutOptions, 'registry'> = {},
): void {
  const registry = options.registry ?? appShortcutRegistry;

  useEffect(() => {
    const release = retainListener(registry);

    registry.reportOverlaps();

    return release;
  }, [registry]);
}
