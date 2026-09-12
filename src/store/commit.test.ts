import { describe, it, expect, beforeEach } from 'vitest';
import { applyRollbackPatches, commit } from './commit';
import { useStore } from './index';
import { readEntity } from '../domain/spatial/applyPatch';
import { normalizeSpatial } from '../domain/spatial/normalize';
import type { Wall } from '../domain/spatial/types';
import { createSampleBuilding } from '../domain/spatial/__fixtures__/sampleBuilding';

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
});
