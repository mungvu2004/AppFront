import { describe, expect, it, vi } from 'vitest';

import {
  buildGlobalShortcuts,
  createShortcutRegistry,
  formatCombo,
  parseCombo,
  registerGlobalShortcuts,
  type GlobalShortcutHandlers,
  type ShortcutKeyEvent,
  type ShortcutRegistry,
} from '../shortcutRegistry';

interface KeyEventFlags {
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
  readonly repeat?: boolean;
}

interface TestKeyEvent extends ShortcutKeyEvent {
  readonly preventDefault: ReturnType<typeof vi.fn>;
}

const keyEvent = (key: string, flags: KeyEventFlags = {}): TestKeyEvent => ({
  key,
  ...flags,
  preventDefault: vi.fn(),
});

const devRegistry = (warn: (message: string) => void = vi.fn()): ShortcutRegistry =>
  createShortcutRegistry({ isDev: true, warn });

interface MockedGlobalHandlers extends GlobalShortcutHandlers {
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  openSearch: ReturnType<typeof vi.fn>;
  openShortcutHelp: ReturnType<typeof vi.fn>;
  closeTopLayer: ReturnType<typeof vi.fn>;
}

const globalHandlers = (): MockedGlobalHandlers => ({
  undo: vi.fn(),
  redo: vi.fn(),
  save: vi.fn(),
  openSearch: vi.fn(),
  openShortcutHelp: vi.fn(),
  closeTopLayer: vi.fn(),
});

describe('parseCombo', () => {
  it('splits modifiers from the main key', () => {
    expect(parseCombo('Ctrl+Shift+Z')).toEqual({
      code: 'Z',
      mod: true,
      alt: false,
      shift: true,
    });
  });

  it('treats Ctrl, Cmd and Mod as the same modifier', () => {
    expect(parseCombo('Cmd+K')).toEqual(parseCombo('Ctrl+K'));
    expect(parseCombo('Mod+K')).toEqual(parseCombo('Ctrl+K'));
  });

  it('normalises the main key so lower and upper case are one binding', () => {
    expect(parseCombo('w')).toEqual(parseCombo('W'));
  });

  it('throws when the combo has no main key', () => {
    expect(() => parseCombo('Ctrl+')).toThrow();
    expect(() => parseCombo('Shift')).toThrow();
  });

  it('throws when the combo has two main keys', () => {
    expect(() => parseCombo('A+B')).toThrow();
  });

  it('refuses to bind Tab', () => {
    expect(() => parseCombo('Tab')).toThrow();
    expect(() => parseCombo('Ctrl+Tab')).toThrow();
  });

  it('prints one canonical spelling back', () => {
    expect(formatCombo(parseCombo('shift+cmd+z'))).toBe('Mod+Shift+Z');
  });
});

describe('scope priority', () => {
  it('fires a canvas binding when no upper scope is active', () => {
    const registry = devRegistry();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    expect(registry.handleKeyDown(keyEvent('w'), null)).toBe(true);
    expect(activateWallTool).toHaveBeenCalledTimes(1);
  });

  it('lets an open dialog swallow keys bound on lower floors', () => {
    const registry = devRegistry();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    const releaseDialog = registry.claimScope('dialog');

    expect(registry.handleKeyDown(keyEvent('w'), null)).toBe(false);
    expect(activateWallTool).not.toHaveBeenCalled();

    releaseDialog();

    expect(registry.handleKeyDown(keyEvent('w'), null)).toBe(true);
    expect(activateWallTool).toHaveBeenCalledTimes(1);
  });

  it('lets an open dialog swallow global chords as well', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);
    registry.claimScope('dialog');

    expect(registry.handleKeyDown(keyEvent('s', { ctrlKey: true }), null)).toBe(false);
    expect(handlers.save).not.toHaveBeenCalled();
  });

  it('prefers a side panel binding over a canvas binding on the same key', () => {
    const registry = devRegistry();
    const canvasHandler = vi.fn();
    const panelHandler = vi.fn();

    registry.register({
      id: 'canvas.tool.placeFurniture',
      combo: 'F',
      scope: 'canvas',
      onTrigger: canvasHandler,
    });
    registry.register({
      id: 'sidePanel.filter.focus',
      combo: 'F',
      scope: 'sidePanel',
      onTrigger: panelHandler,
    });

    registry.handleKeyDown(keyEvent('f'), null);

    expect(panelHandler).toHaveBeenCalledTimes(1);
    expect(canvasHandler).not.toHaveBeenCalled();
  });

  it('lets an unmatched key fall through a non-modal scope', () => {
    const registry = devRegistry();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'sidePanel.filter.focus',
      combo: 'F',
      scope: 'sidePanel',
      onTrigger: vi.fn(),
    });
    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    expect(registry.handleKeyDown(keyEvent('w'), null)).toBe(true);
    expect(activateWallTool).toHaveBeenCalledTimes(1);
  });
});

describe('escape and the top layer', () => {
  it('lets Escape fall through an open dialog to the global close handler', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);
    registry.claimScope('dialog');

    expect(registry.handleKeyDown(keyEvent('Escape'), null)).toBe(true);
    expect(handlers.closeTopLayer).toHaveBeenCalledTimes(1);
  });

  it('prefers a dialog Escape binding over the global one', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();
    const closeDialog = vi.fn();

    registerGlobalShortcuts(registry, handlers);
    registry.register({
      id: 'dialog.deleteFloor.close',
      combo: 'Escape',
      scope: 'dialog',
      onTrigger: closeDialog,
    });

    registry.handleKeyDown(keyEvent('Escape'), null);

    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(handlers.closeTopLayer).not.toHaveBeenCalled();
  });
});

describe('typing guard', () => {
  it.each([['INPUT'], ['TEXTAREA'], ['SELECT']])(
    'fires nothing while the focus is in a %s',
    (tagName) => {
      const registry = devRegistry();
      const handlers = globalHandlers();

      registerGlobalShortcuts(registry, handlers);

      const event = keyEvent('s', { ctrlKey: true });

      expect(registry.handleKeyDown(event, { tagName })).toBe(false);
      expect(handlers.save).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    },
  );

  it('fires nothing inside editable content', () => {
    const registry = devRegistry();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    const target = { tagName: 'DIV', isContentEditable: true };

    expect(registry.handleKeyDown(keyEvent('w'), target)).toBe(false);
    expect(activateWallTool).not.toHaveBeenCalled();
  });
});

describe('ctrl and cmd', () => {
  it('matches a Ctrl combo when the Cmd key is held instead', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    registry.handleKeyDown(keyEvent('z', { ctrlKey: true }), null);
    registry.handleKeyDown(keyEvent('z', { metaKey: true }), null);

    expect(handlers.undo).toHaveBeenCalledTimes(2);
  });

  it('keeps Ctrl+Z and Ctrl+Shift+Z distinct', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    registry.handleKeyDown(keyEvent('z', { ctrlKey: true, shiftKey: true }), null);

    expect(handlers.redo).toHaveBeenCalledTimes(1);
    expect(handlers.undo).not.toHaveBeenCalled();
  });

  it('does not fire a plain-key binding when a modifier is held', () => {
    const registry = devRegistry();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    expect(registry.handleKeyDown(keyEvent('w', { ctrlKey: true }), null)).toBe(false);
    expect(activateWallTool).not.toHaveBeenCalled();
  });

  it('ignores a keydown for a modifier key on its own', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    expect(registry.handleKeyDown(keyEvent('Control', { ctrlKey: true }), null)).toBe(
      false,
    );
  });
});

describe('the help key', () => {
  it('matches ? even though the browser reports Shift held', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    expect(registry.handleKeyDown(keyEvent('?', { shiftKey: true }), null)).toBe(true);
    expect(handlers.openShortcutHelp).toHaveBeenCalledTimes(1);
  });
});

describe('auto-repeat', () => {
  it('ignores a repeat unless the binding allows it', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();
    const activateWallTool = vi.fn();

    registerGlobalShortcuts(registry, handlers);
    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    registry.handleKeyDown(keyEvent('w', { repeat: true }), null);
    registry.handleKeyDown(keyEvent('z', { ctrlKey: true, repeat: true }), null);

    expect(activateWallTool).not.toHaveBeenCalled();
    expect(handlers.undo).toHaveBeenCalledTimes(1);
  });
});

describe('preventDefault', () => {
  it('prevents the browser default on a match', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    const event = keyEvent('s', { ctrlKey: true });

    registry.handleKeyDown(event, null);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('leaves the default alone when nothing matches', () => {
    const registry = devRegistry();
    const event = keyEvent('q');

    expect(registry.handleKeyDown(event, null)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('lets a binding opt out of preventing the default', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    const event = keyEvent('Escape');

    registry.handleKeyDown(event, null);

    expect(handlers.closeTopLayer).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe('registration lifecycle', () => {
  it('stops firing once the binding is unregistered', () => {
    const registry = devRegistry();
    const activateWallTool = vi.fn();

    const dispose = registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });

    dispose();

    expect(registry.handleKeyDown(keyEvent('w'), null)).toBe(false);
    expect(activateWallTool).not.toHaveBeenCalled();
  });

  it('lets the most recent registration on one key answer first', () => {
    const registry = devRegistry();
    const first = vi.fn();
    const second = vi.fn();

    registry.register({
      id: 'canvas.first',
      combo: 'M',
      scope: 'canvas',
      onTrigger: first,
    });
    registry.register({
      id: 'canvas.second',
      combo: 'M',
      scope: 'canvas',
      onTrigger: second,
    });

    registry.handleKeyDown(keyEvent('m'), null);

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});

describe('overlap detection', () => {
  it('warns with both registration sites when one scope doubles a combo', () => {
    const warn = vi.fn();
    const registry = devRegistry(warn);

    registry.register({
      id: 'canvas.first',
      combo: 'M',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });
    registry.register({
      id: 'canvas.second',
      combo: 'M',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"canvas.first"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"canvas.second"'));
  });

  it('sees Ctrl and Cmd spellings of one combo as the same key', () => {
    const warn = vi.fn();
    const registry = devRegistry(warn);

    registry.register({
      id: 'global.first',
      combo: 'Ctrl+K',
      scope: 'global',
      onTrigger: vi.fn(),
    });
    registry.register({
      id: 'global.second',
      combo: 'Cmd+K',
      scope: 'global',
      onTrigger: vi.fn(),
    });

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not treat the same combo on two floors as an overlap', () => {
    const warn = vi.fn();
    const registry = devRegistry(warn);

    registry.register({
      id: 'canvas.escape',
      combo: 'E',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });
    registry.register({
      id: 'sidePanel.escape',
      combo: 'E',
      scope: 'sidePanel',
      onTrigger: vi.fn(),
    });

    expect(warn).not.toHaveBeenCalled();
    expect(registry.findOverlaps()).toEqual([]);
  });

  it('reports every registrant of a doubled key at startup', () => {
    const warn = vi.fn();
    const registry = devRegistry(warn);

    registry.register({
      id: 'canvas.first',
      combo: 'M',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });
    registry.register({
      id: 'canvas.second',
      combo: 'M',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });

    warn.mockClear();

    const overlaps = registry.reportOverlaps();

    expect(overlaps).toEqual([
      {
        scope: 'canvas',
        combo: 'M',
        registrantIds: ['canvas.first', 'canvas.second'],
      },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"canvas.first"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"canvas.second"'));
  });

  it('stays quiet outside development mode', () => {
    const warn = vi.fn();
    const registry = createShortcutRegistry({ isDev: false, warn });

    registry.register({
      id: 'canvas.first',
      combo: 'M',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });
    registry.register({
      id: 'canvas.second',
      combo: 'M',
      scope: 'canvas',
      onTrigger: vi.fn(),
    });
    registry.reportOverlaps();

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('attach', () => {
  interface RecordingTarget {
    readonly listeners: Array<(event: KeyboardEvent) => void>;
    addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
    removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void;
  }

  const recordingTarget = (): RecordingTarget => {
    const listeners: Array<(event: KeyboardEvent) => void> = [];

    return {
      listeners,
      addEventListener: (_type, listener): void => {
        listeners.push(listener);
      },
      removeEventListener: (_type, listener): void => {
        const index = listeners.indexOf(listener);

        if (index >= 0) {
          listeners.splice(index, 1);
        }
      },
    };
  };

  it('routes events from the single listener through the registry', () => {
    const registry = devRegistry();
    const target = recordingTarget();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });
    registry.attach(target);

    expect(target.listeners).toHaveLength(1);

    const listener = target.listeners[0];

    listener?.(keyEvent('w') as unknown as KeyboardEvent);

    expect(activateWallTool).toHaveBeenCalledTimes(1);
  });

  it('reads the focused element off the event before firing', () => {
    const registry = devRegistry();
    const target = recordingTarget();
    const activateWallTool = vi.fn();

    registry.register({
      id: 'canvas.tool.drawWall',
      combo: 'W',
      scope: 'canvas',
      onTrigger: activateWallTool,
    });
    registry.attach(target);

    const event = {
      ...keyEvent('w'),
      target: { tagName: 'INPUT' },
    } as unknown as KeyboardEvent;

    target.listeners[0]?.(event);

    expect(activateWallTool).not.toHaveBeenCalled();
  });

  it('warns on a second attach and keeps the first listener', () => {
    const warn = vi.fn();
    const registry = devRegistry(warn);
    const target = recordingTarget();

    registry.attach(target);
    registry.attach(target);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(target.listeners).toHaveLength(1);
  });

  it('allows a fresh attach after detaching', () => {
    const registry = devRegistry();
    const target = recordingTarget();

    const detach = registry.attach(target);

    detach();

    expect(target.listeners).toHaveLength(0);

    registry.attach(target);

    expect(target.listeners).toHaveLength(1);
  });
});

describe('the global group', () => {
  it('wires all six keys to their handlers', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    registerGlobalShortcuts(registry, handlers);

    registry.handleKeyDown(keyEvent('z', { ctrlKey: true }), null);
    registry.handleKeyDown(keyEvent('z', { ctrlKey: true, shiftKey: true }), null);
    registry.handleKeyDown(keyEvent('s', { ctrlKey: true }), null);
    registry.handleKeyDown(keyEvent('f', { ctrlKey: true }), null);
    registry.handleKeyDown(keyEvent('?', { shiftKey: true }), null);
    registry.handleKeyDown(keyEvent('Escape'), null);

    expect(handlers.undo).toHaveBeenCalledTimes(1);
    expect(handlers.redo).toHaveBeenCalledTimes(1);
    expect(handlers.save).toHaveBeenCalledTimes(1);
    expect(handlers.openSearch).toHaveBeenCalledTimes(1);
    expect(handlers.openShortcutHelp).toHaveBeenCalledTimes(1);
    expect(handlers.closeTopLayer).toHaveBeenCalledTimes(1);
  });

  it('has no internal overlaps', () => {
    const warn = vi.fn();
    const registry = devRegistry(warn);

    registerGlobalShortcuts(registry, globalHandlers());

    expect(registry.findOverlaps()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('removes the whole group with one disposer', () => {
    const registry = devRegistry();
    const handlers = globalHandlers();

    const dispose = registerGlobalShortcuts(registry, handlers);

    dispose();

    expect(registry.handleKeyDown(keyEvent('z', { ctrlKey: true }), null)).toBe(false);
    expect(handlers.undo).not.toHaveBeenCalled();
  });

  it('declares each binding with a stable technical id', () => {
    const ids = buildGlobalShortcuts(globalHandlers()).map(
      (definition) => definition.id,
    );

    expect(ids).toEqual([
      'global.undo',
      'global.redo',
      'global.save',
      'global.search',
      'global.shortcutHelp',
      'global.closeTopLayer',
    ]);
  });
});
