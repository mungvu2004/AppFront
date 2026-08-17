import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useKeyboardMap, type ShellKeyboardHandlers } from './useKeyboardMap';

const pressKey = (key: string, init: KeyboardEventInit = {}): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
};

interface MockedHandlers extends ShellKeyboardHandlers {
  onActivateTool: ReturnType<typeof vi.fn>;
  onOpenHelp: ReturnType<typeof vi.fn>;
  onToggleLeftPanel: ReturnType<typeof vi.fn>;
  onToggleRightPanel: ReturnType<typeof vi.fn>;
}

const mountKeyboardMap = () => {
  const handlers: MockedHandlers = {
    onActivateTool: vi.fn(),
    onOpenHelp: vi.fn(),
    onToggleLeftPanel: vi.fn(),
    onToggleRightPanel: vi.fn(),
  };

  const { unmount } = renderHook(() => useKeyboardMap(handlers));

  return { handlers, unmount };
};

describe('useKeyboardMap', () => {
  it('activates each tool from the key the canonical table declares', () => {
    const { handlers, unmount } = mountKeyboardMap();

    pressKey('v');
    pressKey('w');
    pressKey('m');
    pressKey('d');

    expect(handlers.onActivateTool).toHaveBeenNthCalledWith(1, 'select');
    expect(handlers.onActivateTool).toHaveBeenNthCalledWith(2, 'drawWall');
    expect(handlers.onActivateTool).toHaveBeenNthCalledWith(3, 'measure');
    expect(handlers.onActivateTool).toHaveBeenNthCalledWith(4, 'placeOpening');
    unmount();
  });

  it('leaves the keys of tools the shell does not offer unbound', () => {
    const { handlers, unmount } = mountKeyboardMap();

    pressKey('l');

    expect(handlers.onActivateTool).not.toHaveBeenCalled();
    unmount();
  });

  it('opens help on ? even with Shift reported held', () => {
    const { handlers, unmount } = mountKeyboardMap();

    pressKey('?', { shiftKey: true });

    expect(handlers.onOpenHelp).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('toggles the panels with the bracket keys', () => {
    const { handlers, unmount } = mountKeyboardMap();

    pressKey('[');
    pressKey(']');

    expect(handlers.onToggleLeftPanel).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleRightPanel).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not activate a tool when a modifier is held', () => {
    const { handlers, unmount } = mountKeyboardMap();

    pressKey('w', { ctrlKey: true });
    pressKey('w', { altKey: true });

    expect(handlers.onActivateTool).not.toHaveBeenCalled();
    unmount();
  });

  it('fires nothing while the focus is in a text field', () => {
    const { handlers, unmount } = mountKeyboardMap();
    const input = document.createElement('input');

    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));

    expect(handlers.onActivateTool).not.toHaveBeenCalled();

    input.remove();
    unmount();
  });

  it('goes quiet once unmounted', () => {
    const { handlers, unmount } = mountKeyboardMap();

    unmount();
    pressKey('w');

    expect(handlers.onActivateTool).not.toHaveBeenCalled();
  });
});
