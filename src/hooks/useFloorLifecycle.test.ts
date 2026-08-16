import { Group, MeshStandardMaterial, type Material } from 'three';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { millimetres } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { Wall } from '@/domain/walls/types';
import type { LevelId, RoomId, WallId } from '@/domain/spatial/types';
import type { BuildFloorInput, BuildableRoom } from '@/lib/three/build/floor';
import { readPartData } from '@/lib/three/build/scene';
import { collectMeshes } from '@/lib/three/build/merge';
import { ResourceLedger } from '@/lib/three/perf/dispose';
import { MaterialCache } from '@/lib/three/perf/materialCache';

import { useFloorLifecycle, type FloorLifecycleOptions } from './useFloorLifecycle';

/* -------------------------------------------------------------------------- */
/* Fixtures: a small storey, built often.                                      */
/* -------------------------------------------------------------------------- */

const WALL_COUNT = 6;
const ROOM_COUNT = 2;

/** Walls, floor slabs and ceilings: one geometry each. */
const STOREY_GEOMETRIES = WALL_COUNT + 2 * ROOM_COUNT;

/** Wall, floorSlab, ceiling — the kinds a storey with no openings has. */
const STOREY_KINDS = 3;

/** How many times the swap case changes storey. */
const SWAP_COUNT = 20;

/** The standard sample building has four levels; swapping cycles through them. */
const LEVEL_IDS: readonly LevelId[] = ['L-01', 'L-02', 'L-03', 'L-04'];

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function twoDigits(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

/**
 * A fresh model object every call.
 *
 * Deliberately never memoised: the hook must not rebuild just because the object
 * is a new one, and a test that reused the object would not prove that.
 */
function storeyModel(levelId: LevelId = 'L-01'): BuildFloorInput {
  const walls: readonly Wall[] = Array.from({ length: WALL_COUNT }, (_unused, index): Wall => ({
    id: `W-${twoDigits(index + 1)}` as WallId,
    kind: 'partition',
    centreline: { start: pointAt(0, index * 6000), end: pointAt(4000, index * 6000) },
    thicknessMm: millimetres(200),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  }));

  const rooms: readonly BuildableRoom[] = Array.from(
    { length: ROOM_COUNT },
    (_unused, index): BuildableRoom => {
      const offsetMm = index * 6000;
      return {
        id: `R-${twoDigits(index + 1)}` as RoomId,
        outline: [
          pointAt(offsetMm, 0),
          pointAt(offsetMm + 5000, 0),
          pointAt(offsetMm + 5000, 4000),
          pointAt(offsetMm, 4000),
        ],
      };
    },
  );

  return {
    level: { id: levelId, elevationMm: millimetres(0), heightMm: millimetres(3000) },
    walls,
    rooms,
  };
}

function plainMaterial(): Material {
  return new MeshStandardMaterial();
}

function levelAt(swap: number): LevelId {
  return LEVEL_IDS[swap % LEVEL_IDS.length] ?? 'L-01';
}

/* -------------------------------------------------------------------------- */
/* Tests.                                                                      */
/* -------------------------------------------------------------------------- */

describe('useFloorLifecycle', () => {
  it('builds a storey and adds it to the parent', () => {
    const scene = new Group();
    const { result } = renderHook(() => useFloorLifecycle({ model: storeyModel(), parent: scene }));

    expect(result.current.group).not.toBeNull();
    expect(scene.children).toHaveLength(1);
    expect(scene.children[0]).toBe(result.current.group);
  });

  it('builds nothing when there is no storey to draw', () => {
    const scene = new Group();
    const { result } = renderHook(() => useFloorLifecycle({ model: null, parent: scene }));

    expect(result.current.group).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it('frees the storey when the view goes away', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();
    const { unmount } = renderHook(() =>
      useFloorLifecycle({ model: storeyModel(), parent: scene, ledger }),
    );

    expect(ledger.counts.geometries).toBe(STOREY_GEOMETRIES);

    unmount();

    expect(ledger.counts.geometries).toBe(0);
    expect(scene.children).toHaveLength(0);
  });

  it('keeps one storey alive through twenty swaps and none after the last', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();

    const { rerender, unmount } = renderHook(
      (props: FloorLifecycleOptions) => useFloorLifecycle(props),
      { initialProps: { model: storeyModel(levelAt(0)), parent: scene, ledger } },
    );

    for (let swap = 1; swap <= SWAP_COUNT; swap += 1) {
      rerender({ model: storeyModel(levelAt(swap)), parent: scene, ledger });

      // Exactly one storey is alive, whichever swap we are on.
      expect(ledger.counts.geometries).toBe(STOREY_GEOMETRIES);
      expect(scene.children).toHaveLength(1);
    }

    unmount();

    expect(ledger.counts.geometries).toBe(0);
    expect(scene.children).toHaveLength(0);
  });

  it('does not rebuild when the storey is still the same one', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();

    const { result, rerender } = renderHook(
      (props: FloorLifecycleOptions) => useFloorLifecycle(props),
      { initialProps: { model: storeyModel(), parent: scene, ledger } },
    );
    const first = result.current.group;

    // A brand new model object each time, which is what a view naturally writes.
    rerender({ model: storeyModel(), parent: scene, ledger });
    rerender({ model: storeyModel(), parent: scene, ledger });

    expect(result.current.group).toBe(first);
    expect(ledger.counts.geometries).toBe(STOREY_GEOMETRIES);
  });

  it('survives a caller that builds a new model object on every render', () => {
    // The design refusal, stated as a test: this is the call that would lock the
    // tab in an infinite rebuild if the effect watched the model's identity.
    const ledger = new ResourceLedger();
    const { result } = renderHook(() =>
      useFloorLifecycle({ model: storeyModel(), ledger, createMaterial: () => plainMaterial() }),
    );

    expect(result.current.group).not.toBeNull();
    expect(ledger.counts.geometries).toBe(STOREY_GEOMETRIES);
  });

  it('rebuilds a storey edited in place when the revision is bumped', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();

    const { result, rerender } = renderHook(
      (props: FloorLifecycleOptions) => useFloorLifecycle(props),
      { initialProps: { model: storeyModel(), parent: scene, ledger, revision: 1 } },
    );
    const first = result.current.group;

    rerender({ model: storeyModel(), parent: scene, ledger, revision: 2 });

    expect(result.current.group).not.toBe(first);
    expect(ledger.counts.geometries).toBe(STOREY_GEOMETRIES);
    expect(scene.children).toHaveLength(1);
  });

  it('shares one material per part kind, and hands them back on unmount', () => {
    const cache = new MaterialCache();
    const scene = new Group();

    const { result, unmount } = renderHook(() =>
      useFloorLifecycle({
        model: storeyModel(),
        parent: scene,
        materials: cache,
        createMaterial: plainMaterial,
      }),
    );

    const group = result.current.group;
    expect(group).not.toBeNull();

    const walls = collectMeshes(group as Group).filter(
      (mesh) => readPartData(mesh)?.kind === 'wall',
    );
    expect(walls).toHaveLength(WALL_COUNT);
    expect(walls[0]?.material).toBe(walls[1]?.material);
    expect(cache.size).toBe(STOREY_KINDS);

    unmount();

    expect(cache.size).toBe(0);
  });

  it('keeps a shared material alive while a second view still draws with it', () => {
    const cache = new MaterialCache();
    const options = (): FloorLifecycleOptions => ({
      model: storeyModel(),
      materials: cache,
      createMaterial: plainMaterial,
    });

    const first = renderHook(() => useFloorLifecycle(options()));
    const second = renderHook(() => useFloorLifecycle(options()));

    expect(cache.size).toBe(STOREY_KINDS);

    first.unmount();
    expect(cache.size).toBe(STOREY_KINDS);

    second.unmount();
    expect(cache.size).toBe(0);
  });

  it('never lets the live count climb across a run of swaps', () => {
    const ledger = new ResourceLedger();
    const scene = new Group();

    const { rerender, unmount } = renderHook(
      (props: FloorLifecycleOptions) => useFloorLifecycle(props),
      { initialProps: { model: storeyModel(levelAt(0)), parent: scene, ledger } },
    );

    for (let swap = 1; swap <= 8; swap += 1) {
      rerender({ model: storeyModel(levelAt(swap)), parent: scene, ledger });
      // Nothing is climbing, which is what a ledger is for.
      expect(ledger.sample()).toEqual([]);
    }

    unmount();
  });

  it('leaves the group detached when it is given no parent', () => {
    const { result } = renderHook(() => useFloorLifecycle({ model: storeyModel() }));

    expect(result.current.group).not.toBeNull();
    expect(result.current.group?.parent).toBeNull();
  });
});
