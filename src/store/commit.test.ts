import { describe, it, expect, beforeEach, vi } from 'vitest';
import { applyRollbackPatches, commit, replaceFloorLayer } from './commit';
import { useStore } from './index';
import { readEntity } from '../domain/spatial/applyPatch';
import { normalizeSpatial } from '../domain/spatial/normalize';
import type { Wall } from '../domain/spatial/types';
import { createSampleBuilding, sampleLevelId } from '../domain/spatial/__fixtures__/sampleBuilding';

const firstSampleWall = (): Wall => {
  const wall = createSampleBuilding().walls.at(0);

  if (wall === undefined) {
    throw new Error('sample building has no walls');
  }

  return wall;
};

const storedWallThickness = (wallId: Wall['id']): number => {
  const { spatial } = useStore.getState();

  if (spatial === null) {
    throw new Error('spatial data is not loaded');
  }

  const wall = readEntity(spatial, 'wall', wallId);

  if (wall === null) {
    throw new Error(`wall ${wallId} is missing from the store`);
  }

  return wall.thicknessMm;
};

describe('store/commit.ts', () => {
  beforeEach(() => {
    useStore.temporal.getState().clear();
    useStore.setState({
      spatial: normalizeSpatial(createSampleBuilding()),
      versionId: 'v1',
    });
  });

  it('commits changes and supports undo', () => {
    const wall = firstSampleWall();

    const result = commit(
      { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 100 } },
      'Đổi độ dày tường'
    );

    expect(result.label).toBe('Đổi độ dày tường');
    expect(storedWallThickness(wall.id)).toBe(wall.thicknessMm + 100);
    expect(useStore.getState().lastCommitLabel).toBe('Đổi độ dày tường');

    result.undo();

    expect(storedWallThickness(wall.id)).toBe(wall.thicknessMm);
  });

  it('applies a batch as one undo step', () => {
    const wall = firstSampleWall();

    const result = commit(
      [
        { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 20 } },
        { op: 'update', kind: 'wall', id: wall.id, changes: { heightMm: wall.heightMm + 200 } },
      ],
      'Sửa tường'
    );

    expect(storedWallThickness(wall.id)).toBe(wall.thicknessMm + 20);

    result.undo();

    expect(storedWallThickness(wall.id)).toBe(wall.thicknessMm);
  });

  it('rolls a failed dispatch back without leaving a step for Ctrl+Z to find', () => {
    const wall = firstSampleWall();
    const pastStatesBefore = useStore.temporal.getState().pastStates.length;

    // A command that got as far as the store, then failed at `rules` or `sync`.
    commit(
      { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 100 } },
      'Thêm tường'
    );

    expect(useStore.temporal.getState().pastStates).toHaveLength(pastStatesBefore + 1);

    applyRollbackPatches([
      { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm } },
    ]);

    // The graph is back, and the rollback opened nothing of its own: going
    // through `commit` left a second past state, and the user's next Ctrl+Z then
    // re-applied the change that had just been cancelled.
    expect(storedWallThickness(wall.id)).toBe(wall.thicknessMm);
    expect(useStore.temporal.getState().pastStates).toHaveLength(pastStatesBefore + 1);

    useStore.temporal.getState().undo();

    expect(storedWallThickness(wall.id)).toBe(wall.thicknessMm);
  });

  describe('replaceFloorLayer', () => {
    const floorId = sampleLevelId(0);
    const layerWithoutFirstWall = () => {
      const graph = createSampleBuilding();
      const walls = graph.walls.filter((wall) => wall.levelId === floorId);
      const wallIds = new Set<string>(walls.map((wall) => wall.id));

      return {
        furniture: graph.furniture.filter((item) => item.levelId === floorId),
        openings: graph.openings.filter((opening) => wallIds.has(opening.wallId)),
        rooms: graph.rooms.filter((room) => room.levelId === floorId),
        walls: walls.slice(1),
      };
    };

    it('writes the store once and opens no undo step', () => {
      const pastBefore = useStore.temporal.getState().pastStates.length;
      const listener = vi.fn();
      const stop = useStore.subscribe(listener);

      replaceFloorLayer(floorId, { layer: layerWithoutFirstWall(), revision: 7 });
      stop();

      const state = useStore.getState();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(useStore.temporal.getState().pastStates).toHaveLength(pastBefore);
      expect(state.floorMeta[floorId]).toEqual({ revision: 7 });
      expect(state.lastServerSpatial).toBe(state.spatial);
      expect(state.serverReplaceSeq).toBe(0);
      expect(state.spatial?.byKind.wall).toHaveLength(createSampleBuilding().walls.length - 1);
    });

    it('only records the revision when the store lacks the floor', () => {
      const before = useStore.getState().spatial;

      replaceFloorLayer('L-UNKNOWN000', { layer: layerWithoutFirstWall(), revision: 2 });

      expect(useStore.getState().spatial).toBe(before);
      expect(useStore.getState().floorMeta['L-UNKNOWN000']).toEqual({ revision: 2 });

      useStore.setState({ spatial: null });
      replaceFloorLayer(floorId, { layer: layerWithoutFirstWall(), revision: 3 });

      expect(useStore.getState().spatial).toBeNull();
      expect(useStore.getState().floorMeta[floorId]).toEqual({ revision: 3 });
    });

    it('external clears the history and bumps serverReplaceSeq', () => {
      const wall = firstSampleWall();

      commit({ op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: wall.thicknessMm + 50 } }, 'Sửa');
      expect(useStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

      replaceFloorLayer(floorId, { layer: layerWithoutFirstWall(), revision: 9 }, { external: true });

      expect(useStore.temporal.getState().pastStates).toHaveLength(0);
      expect(useStore.getState().serverReplaceSeq).toBe(1);
    });
  });
});
