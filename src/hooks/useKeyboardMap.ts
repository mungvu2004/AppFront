/**
 * The shell's keyboard map, declared in one place.
 *
 * Every key the application shell owns — the four tool keys, the help key,
 * the two panel toggles — is listed here and nowhere else, so adding or
 * changing a shell key is one edit in one file. The hook registers each key
 * on `appShortcutRegistry` (the one arbiter) and holds the window listener
 * lease through `useShortcutListener`, which also runs the development-mode
 * overlap audit at startup.
 *
 * What each key *does* is injected by the caller: this hook knows the map,
 * the shell knows the behaviour. Keys owned by an overlay stay with the
 * overlay — Cmd/Ctrl+K lives in CommandPalette, Escape lives with each
 * layer — so this file never grows a second copy of another component's
 * keyboard.
 */

import { useShortcut, useShortcutListener } from './useShortcut';

/** The tools the shell toolbar can put in hand. */
export type ShellTool = 'select' | 'wall' | 'dimension' | 'door';

/** What the shell does when its keys fire. */
export interface ShellKeyboardHandlers {
  onActivateTool: (tool: ShellTool) => void;
  onOpenHelp: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
}

export function useKeyboardMap(handlers: ShellKeyboardHandlers): void {
  useShortcutListener();

  useShortcut({
    id: 'shell.tool.select',
    combo: 'V',
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('select'),
  });
  useShortcut({
    id: 'shell.tool.wall',
    combo: 'W',
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('wall'),
  });
  useShortcut({
    id: 'shell.tool.dimension',
    combo: 'M',
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('dimension'),
  });
  useShortcut({
    id: 'shell.tool.door',
    combo: 'L',
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('door'),
  });

  useShortcut({
    id: 'shell.shortcutHelp.open',
    combo: '?',
    scope: 'global',
    onTrigger: () => handlers.onOpenHelp(),
  });

  useShortcut({
    id: 'shell.panel.left',
    combo: '[',
    scope: 'global',
    onTrigger: () => handlers.onToggleLeftPanel(),
  });
  useShortcut({
    id: 'shell.panel.right',
    combo: ']',
    scope: 'global',
    onTrigger: () => handlers.onToggleRightPanel(),
  });
}
