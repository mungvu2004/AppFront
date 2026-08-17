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

import type { ToolId } from '../lib/tools/toolMachine';
import { shortcutForTool } from '../lib/tools/shortcuts';
import { useShortcut, useShortcutListener } from './useShortcut';

/**
 * The tools the shell toolbar offers today, in toolbar order — a subset of
 * the canonical `ToolId` roster of the tool machine, so the shell and the
 * tool layer speak one vocabulary and nothing needs translating between
 * them. Their keys are read from `TOOL_SHORTCUTS` (the keyboard declared
 * once, lib/tools/shortcuts), never restated here.
 */
export const SHELL_TOOL_IDS = [
  'select',
  'drawWall',
  'measure',
  'placeOpening',
] as const satisfies readonly ToolId[];

export type ShellToolId = (typeof SHELL_TOOL_IDS)[number];

/** What the shell does when its keys fire. */
export interface ShellKeyboardHandlers {
  onActivateTool: (tool: ShellToolId) => void;
  onOpenHelp: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
}

export function useKeyboardMap(handlers: ShellKeyboardHandlers): void {
  useShortcutListener();

  useShortcut({
    id: 'shell.tool.select',
    combo: shortcutForTool('select'),
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('select'),
  });
  useShortcut({
    id: 'shell.tool.drawWall',
    combo: shortcutForTool('drawWall'),
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('drawWall'),
  });
  useShortcut({
    id: 'shell.tool.measure',
    combo: shortcutForTool('measure'),
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('measure'),
  });
  useShortcut({
    id: 'shell.tool.placeOpening',
    combo: shortcutForTool('placeOpening'),
    scope: 'canvas',
    onTrigger: () => handlers.onActivateTool('placeOpening'),
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
