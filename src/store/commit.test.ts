import { describe, it, expect, beforeEach } from 'vitest';
import { commit } from './commit';
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
});
