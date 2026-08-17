/**
 * The one line in `vitest.setup.ts`, checked against the real store.
 *
 * `createStoreReset` is unit-tested in `src/lib/testing/__tests__/helpers.test.tsx`
 * against a plain zustand store, because `src/lib/**` may not import
 * `src/store/**` — mục 0.4. That leaves the question the unit test cannot ask:
 * does it work on *this* store, the one wrapped in `devtools`, `persist` and
 * `temporal`? Middleware changes the shape of `setState` and gives the store a
 * history that outlives any component tree, and a reset that quietly missed
 * either would show up as tests passing in order and failing alone.
 *
 * So the check lives here, in the only tree allowed to see both sides.
 */

import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { createSampleBuilding } from '../../domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import type { Wall } from '../../domain/spatial/types';
import { commit } from '../commit';
import { useStore } from '../index';

/**
 * What the store boots with.
 *
 * Read while this module is being collected — after `vitest.setup.ts` has taken
 * its snapshot and before any test has changed anything — so the two agree by
 * construction rather than by a number written down twice.
 */
const BOOT_ZOOM = useStore.getState().zoom;
const BOOT_LEFT_PANEL_OPEN = useStore.getState().leftPanelOpen;

/** Any wall from the sample building, for a patch that has something to change. */
function firstSampleWall(): Wall {
  const wall = createSampleBuilding().walls.at(0);

  if (wall === undefined) {
    throw new Error('sample building has no walls');
  }

  return wall;
}

describe('the wiring in vitest.setup.ts, against the real store', () => {
  it('puts the state back before a render, and leaves the actions working', () => {
    useStore.getState().setZoom(BOOT_ZOOM + 1);
    useStore.getState().setPanelOpen('left', !BOOT_LEFT_PANEL_OPEN);
    expect(useStore.getState().zoom).not.toBe(BOOT_ZOOM);

    renderWithProviders(<p>Một</p>);

    expect(useStore.getState().zoom).toBe(BOOT_ZOOM);
    expect(useStore.getState().leftPanelOpen).toBe(BOOT_LEFT_PANEL_OPEN);

    // `replace: true` throws the whole state away, actions included, so this is
    // the half of the reset that would fail silently: a store with its data back
    // and its actions gone renders once and then does nothing.
    useStore.getState().setZoom(BOOT_ZOOM + 2);
    expect(useStore.getState().zoom).toBe(BOOT_ZOOM + 2);
  });

  it('clears undo history, so one test cannot undo another one', () => {
    useStore.setState({ spatial: normalizeSpatial(createSampleBuilding()), versionId: 'v1' });
    const wall = firstSampleWall();

    commit(
      { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 100 } },
      'Đổi độ dày tường',
    );
    expect(useStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    renderWithProviders(<p>Một</p>);

    expect(useStore.temporal.getState().pastStates).toEqual([]);
  });

  it('leaves the store alone when a test says it seeded it on purpose', () => {
    useStore.getState().setZoom(BOOT_ZOOM + 3);

    renderWithProviders(<p>Một</p>, { keepStore: true });

    expect(useStore.getState().zoom).toBe(BOOT_ZOOM + 3);
  });
});
