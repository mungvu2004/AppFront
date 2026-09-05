/**
 * One drag, one undo step — measured on the store zundo actually undoes.
 *
 * `lib/commands/history` has folded runs of edits for a long time, but the undo
 * the application performs is `useStore.temporal`, and the two stacks did not
 * know about each other: two writes 200 ms apart — inside the 400 ms window —
 * left two zundo steps, so one Ctrl+Z gave back half a drag. `commit` now folds
 * the run before it reaches zundo, and folding is only worth anything if the
 * conditions that *close* a run are as sharp as the one that continues it. Both
 * halves are measured here.
 *
 * No test writes 400. The window is `MERGE_WINDOW_MS` (R-71), which is
 * `COALESCE_WINDOW_MS` — the sync queue and the undo stack cut in the same
 * places by construction.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';

import { createSampleBuilding } from '../../domain/spatial/__fixtures__/sampleBuilding';
import { readEntity } from '../../domain/spatial/applyPatch';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import type { Wall } from '../../domain/spatial/types';
import { commit, resetCommitRun } from '../commit';
import { useStore } from '../index';

/** Half the window: two writes this far apart are one drag, by definition. */
const INSIDE_WINDOW_MS = Math.floor(MERGE_WINDOW_MS / 2);

const firstSampleWall = (): Wall => {
  const wall = createSampleBuilding().walls.at(0);

  if (wall === undefined) {
    throw new Error('sample building has no walls');
  }

  return wall;
};

const storedWall = (wallId: Wall['id']): Wall => {
  const { spatial } = useStore.getState();

  if (spatial === null) {
    throw new Error('spatial data is not loaded');
  }

  const wall = readEntity(spatial, 'wall', wallId);

  if (wall === null) {
    throw new Error(`wall ${wallId} is missing from the store`);
  }

  return wall;
};

const undoSteps = (): number => useStore.temporal.getState().pastStates.length;

const setThickness = (wall: Wall, thicknessMm: number): void => {
  commit(
    { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm } },
    `Đổi độ dày tường thành ${String(thicknessMm)} mm.`,
  );
};

describe('store/commit.ts — cửa sổ gộp của tầng lệnh áp lên ngăn xếp zundo', () => {
  let clock: FakeClock;

  beforeEach(() => {
    useStore.setState({
      spatial: normalizeSpatial(createSampleBuilding()),
      versionId: 'v1',
    });
    resetCommitRun();
    useStore.temporal.getState().clear();
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  it('gộp hai lượt ghi trong cửa sổ thành MỘT bước, và một lượt hoàn tác trả về giá trị đầu mạch', async () => {
    const wall = firstSampleWall();
    const before = wall.thicknessMm;

    setThickness(wall, before + 10);
    await clock.advance(INSIDE_WINDOW_MS);
    setThickness(wall, before + 20);

    expect(storedWall(wall.id).thicknessMm).toBe(before + 20);
    expect(undoSteps()).toBe(1);

    useStore.temporal.getState().undo();

    // Đúng thứ `mergeCommands` giữ lại: ảnh chụp `before` của lệnh ĐẦU mạch.
    expect(storedWall(wall.id).thicknessMm).toBe(before);
    expect(undoSteps()).toBe(0);
  });

  it('một mạch dài hơn cửa sổ vẫn là một bước, vì khoảng cách đo giữa hai lượt liền nhau', async () => {
    const wall = firstSampleWall();
    const before = wall.thicknessMm;

    for (let step = 1; step <= 6; step += 1) {
      setThickness(wall, before + step);
      await clock.advance(INSIDE_WINDOW_MS);
    }

    expect(storedWall(wall.id).thicknessMm).toBe(before + 6);
    expect(undoSteps()).toBe(1);

    useStore.temporal.getState().undo();

    expect(storedWall(wall.id).thicknessMm).toBe(before);
  });

  it('bàn tay dừng đủ một cửa sổ thì đóng mạch: hai bước, hoàn tác trả về từng nấc', async () => {
    const wall = firstSampleWall();
    const before = wall.thicknessMm;

    setThickness(wall, before + 10);
    await clock.advance(MERGE_WINDOW_MS);
    setThickness(wall, before + 20);

    expect(undoSteps()).toBe(2);

    useStore.temporal.getState().undo();

    expect(storedWall(wall.id).thicknessMm).toBe(before + 10);
  });

  it('đổi sang trường khác là một hành động khác, không gộp dù sát nhau', async () => {
    const wall = firstSampleWall();

    setThickness(wall, wall.thicknessMm + 10);
    await clock.advance(INSIDE_WINDOW_MS);
    commit(
      { op: 'update', kind: 'wall', id: wall.id, changes: { heightMm: wall.heightMm + 200 } },
      'Đổi chiều cao tường.',
    );

    expect(undoSteps()).toBe(2);
  });

  it('một lượt ghi lạ chen vào giữa thì đóng mạch, dù đồng hồ vẫn trong cửa sổ', async () => {
    const wall = firstSampleWall();

    setThickness(wall, wall.thicknessMm + 10);
    await clock.advance(INSIDE_WINDOW_MS);

    // Ai đó nạp lại đồ thị — không phải một lệnh, nên mạch kéo đã hết.
    useStore.setState({ spatial: normalizeSpatial(createSampleBuilding()), versionId: 'v2' });
    setThickness(wall, wall.thicknessMm + 20);

    expect(undoSteps()).toBe(3);
  });

  it('hoàn tác giữa mạch cũng đóng mạch: lượt ghi sau nó mở bước mới', async () => {
    const wall = firstSampleWall();
    const before = wall.thicknessMm;

    setThickness(wall, before + 10);
    await clock.advance(INSIDE_WINDOW_MS);
    useStore.temporal.getState().undo();
    setThickness(wall, before + 20);

    expect(undoSteps()).toBe(1);

    useStore.temporal.getState().undo();

    expect(storedWall(wall.id).thicknessMm).toBe(before);
  });
});
