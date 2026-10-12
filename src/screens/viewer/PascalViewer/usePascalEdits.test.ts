/**
 * Đường lưu của màn Pascal, chạy đủ năm chặng trên store thật.
 *
 * Bài quan trọng nhất là bài thứ hai: **một lượt sửa trong Pascal phải tới được
 * `state.spatial`.** Hỏng nó thì màn hình hiện một bức tường mới, người dùng tin
 * là đã lưu, và không có nút lưu nào để họ thử lại — A7 không cho họ cơ hội ấy.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toPascalScene } from '@/lib/pascal/toPascal';
import type { PascalNode, PascalScene } from '@/lib/pascal/types';
import { useStore } from '@/store';

import {
  commitOfScenes,
  PASCAL_READ_ONLY_REASON,
  usePascalEdits,
} from './usePascalEdits';

const BUILDING = createSampleBuilding();
const SPATIAL = normalizeSpatial(BUILDING);
const SCENE = toPascalScene(BUILDING).scene;

const firstWall = (): PascalNode => {
  const wall = Object.values(SCENE.nodes).find((node) => node.type === 'wall');

  if (wall === undefined || wall.type !== 'wall') {
    throw new Error('bộ mẫu phải có ít nhất một tường');
  }

  return wall;
};

/** Cảnh nền, tường đầu tiên dày thêm 130 mm. */
const thickened = (): PascalScene => {
  const wall = firstWall();

  return {
    nodes: { ...SCENE.nodes, [wall.id]: { ...wall, thickness: 0.33 } },
    rootNodeIds: SCENE.rootNodeIds,
  };
};

const mount = (overrides: { readonly readOnly?: boolean; readonly onRejected?: (reason: string) => void } = {}) =>
  renderHook(() =>
    usePascalEdits({
      spatial: useStore.getState().spatial,
      loadedScene: SCENE,
      readOnly: overrides.readOnly ?? false,
      onRejected: overrides.onRejected ?? (() => undefined),
    }),
  );

beforeEach(() => {
  act(() => {
    useStore.getState().setSpatial(SPATIAL, null);
  });
});

afterEach(() => {
  act(() => {
    useStore.getState().setSpatial(null, null);
  });
});

describe('commitOfScenes', () => {
  it('hai cảnh y hệt: không có lượt ghi nào', () => {
    expect(commitOfScenes(SCENE, SCENE)).toBeNull();
  });

  it('một tường đổi: đúng node ấy vào danh sách đã đổi, danh sách xoá rỗng', () => {
    const commit = commitOfScenes(SCENE, thickened());

    expect(commit?.changedNodeIds).toEqual([firstWall().id]);
    expect(commit?.removedNodeIds).toEqual([]);
  });
});

describe('usePascalEdits', () => {
  it('nạp xong mà chưa ai sửa gì: KHÔNG ghi vào bản vẽ', async () => {
    const { result } = mount();
    const before = useStore.getState().spatial;

    await act(async () => {
      await result.current.onSceneCommit(SCENE);
    });

    expect(useStore.getState().spatial).toBe(before);
  });

  it('sửa độ dày một tường thì bản vẽ trong store đổi theo (A10 — qua commit)', async () => {
    const { result } = mount();
    const wallId = Object.keys(SPATIAL.byId).find((id) => id.startsWith('W-'));

    if (wallId === undefined) throw new Error('bản vẽ phải có tường');

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    const after = useStore.getState().spatial?.byId[wallId];

    expect(after !== undefined && 'thicknessMm' in after ? after.thicknessMm : null).toBe(330);
  });

  it('C2 — bức tường vừa sửa mất dấu xác minh', async () => {
    const { result } = mount();
    const wallId = Object.keys(SPATIAL.byId).find((id) => id.startsWith('W-'));

    if (wallId === undefined) throw new Error('bản vẽ phải có tường');

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    expect(useStore.getState().spatial?.byId[wallId]?.reviewed).toBe(false);
  });

  it('vai chỉ-xem: `validateCommit` từ chối và `onSceneCommit` không ghi gì', async () => {
    const onRejected = vi.fn();
    const { result } = mount({ readOnly: true, onRejected });
    const before = useStore.getState().spatial;

    expect(result.current.validateCommit(thickened())).toEqual({
      ok: false,
      message: PASCAL_READ_ONLY_REASON,
    });

    await act(async () => {
      await result.current.onSceneCommit(thickened());
    });

    expect(useStore.getState().spatial).toBe(before);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('6A — cổng chặn lượt xoá hàng loạt, và nói ra lý do bằng tiếng Việt', async () => {
    const onRejected = vi.fn();
    const { result } = mount({ onRejected });
    const before = useStore.getState().spatial;

    /* Bỏ hẳn mọi tường của cảnh: đúng thứ `MASS_DELETE_RATIO` tồn tại để chặn. */
    const gutted: PascalScene = {
      nodes: Object.fromEntries(
        Object.entries(SCENE.nodes).filter(([, node]) => node.type !== 'wall'),
      ),
      rootNodeIds: SCENE.rootNodeIds,
    };

    const verdict = result.current.validateCommit(gutted);

    expect(verdict.ok).toBe(false);
    expect(verdict.ok ? '' : verdict.message).toMatch(/\p{L}/u);

    await act(async () => {
      await result.current.onSceneCommit(gutted);
    });

    expect(useStore.getState().spatial).toBe(before);
    expect(onRejected).toHaveBeenCalledTimes(1);
  });
});
