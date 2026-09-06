import { describe, expect, it, vi } from 'vitest';

import { createShortcutRegistry, type ShortcutRegistry } from '../shortcutRegistry';

/**
 * `listShortcuts()` — the read side K1 needed and the registry did not have.
 * `useAccountTables.ts` and `shortcutRegistry.ts` both used to say so in a
 * comment; this is the test that the comment is now wrong.
 */
const devRegistry = (): ShortcutRegistry => createShortcutRegistry({ isDev: false });

describe('listShortcuts', () => {
  it('is empty on a registry nothing has registered on', () => {
    expect(devRegistry().listShortcuts()).toEqual([]);
  });

  it('reports the canonical combo, not the spelling the caller registered', () => {
    const registry = devRegistry();

    registry.register({
      id: 'test.ctrlShiftZ',
      combo: 'ctrl+shift+z',
      scope: 'global',
      description: 'làm lại',
      onTrigger: () => {},
    });

    expect(registry.listShortcuts()).toEqual([
      { id: 'test.ctrlShiftZ', combo: 'Mod+Shift+Z', scope: 'global', description: 'làm lại' },
    ]);
  });

  it('omits `description` entirely for a binding that declared none', () => {
    const registry = devRegistry();

    registry.register({ id: 'test.noDescription', combo: 'Escape', scope: 'dialog', onTrigger: () => {} });

    const [row] = registry.listShortcuts();

    expect(row).toEqual({ id: 'test.noDescription', combo: 'ESCAPE', scope: 'dialog' });
    expect(row).not.toHaveProperty('description');
  });

  it('drops a binding the moment its unregister function runs', () => {
    const registry = devRegistry();

    const unregister = registry.register({
      id: 'test.temporary',
      combo: 'F',
      scope: 'canvas',
      description: 'khuôn vào khung hình',
      onTrigger: () => {},
    });

    expect(registry.listShortcuts().map((row) => row.id)).toContain('test.temporary');

    unregister();

    expect(registry.listShortcuts().map((row) => row.id)).not.toContain('test.temporary');
  });

  it('lists every scope at once, leaving grouping to the caller', () => {
    const registry = devRegistry();
    const onTrigger = vi.fn();

    registry.register({ id: 'g', combo: 'Z', scope: 'global', description: 'toàn cục', onTrigger });
    registry.register({ id: 'c', combo: 'F', scope: 'canvas', description: 'khung nhìn', onTrigger });
    registry.register({ id: 's', combo: 'Escape', scope: 'sidePanel', description: 'bảng bên', onTrigger });

    const scopes = registry.listShortcuts().map((row) => row.scope);

    expect(scopes).toEqual(['global', 'canvas', 'sidePanel']);
  });
});
