import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient, simulateRemoteLayerEdit } from '@/api/__mocks__/client';
import {
  createSampleBuilding,
  sampleFurnitureId,
  sampleLevelId,
  sampleRoomId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Furniture, FurnitureId } from '@/domain/spatial/types';
import { __resetFloorLayerSavers } from '@/hooks/useAutosave';
import { LAYER_SAVE_MESSAGES } from '@/lib/autosave/spatialLayerSave';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { useViewer3DSave } from './useViewer3DSave';

const PROJECT = 'P-1';
const SAMPLE = normalizeSpatial(createSampleBuilding());

/** Phòng 2 của bộ mẫu nằm ở tầng 2 (`index % 4`). */
const ROOM_INDEX = 2;

const tick = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** Thả một đồ đạc mới, chép từ đồ đạc 0 của bộ mẫu — không chọn gì. */
const dropFurniture = (): string => {
  const source = SAMPLE.byId[sampleFurnitureId(0)] as Furniture;
  const entity: Furniture = { ...source, id: 'F-FURN9999990' as FurnitureId };

  commit({ entity, kind: 'furniture', op: 'add' }, 'Thả đồ đạc');

  return source.levelId;
};

describe('useViewer3DSave — tự lưu cấp màn /3d qua saver lớp tầng', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetFloorLayerSavers();
    __resetMockLayerState();
    useStore.getState().clearSelection();
    useStore
      .getState()
      .setSpatial(SAMPLE, 'v-test', {
        floorRevisions: Object.fromEntries(SAMPLE.byKind.level.map((id) => [id, 0])),
        projectId: PROJECT,
      });
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    useStore.getState().setSpatial(null, null);
    vi.useRealTimers();
  });

  it('không panel nào dựng: đổi tên một phòng vẫn gửi đúng tầng của phòng ấy, và nói giờ lưu', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const { result } = renderHook(() => useViewer3DSave(PROJECT, apiClient));

    await tick();
    act(() => {
      commit({ changes: { name: 'Phòng mới' }, id: sampleRoomId(ROOM_INDEX), kind: 'room', op: 'update' }, 'đổi tên');
    });
    await tick(800);

    expect(writeLayer.mock.calls.map(([input]) => input.floorId)).toEqual([sampleLevelId(ROOM_INDEX)]);
    expect(result.current.label).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
    expect(result.current.saveBlock).toBeNull();
  });

  it('thả đồ đạc, không chọn gì → một PUT; tầng ấy bị sửa nơi khác → 409 → dải kèm tên tầng, không resolveConflict', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const { result } = renderHook(() => useViewer3DSave(PROJECT, apiClient));

    await tick();
    const floorId = dropFurniture();

    await tick(800);
    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 0, floorId });
    expect(useStore.getState().selectedIds).toEqual([]);

    simulateRemoteLayerEdit(floorId);
    act(() => {
      commit({ id: 'F-FURN9999990' as FurnitureId, kind: 'furniture', op: 'remove' }, 'Xoá đồ đạc');
    });
    await tick(800);

    const levelName = (SAMPLE.byId[floorId] as { name: string }).name;

    expect(writeLayer).toHaveBeenCalledTimes(2);
    expect(result.current.saveBlock).toMatchObject({
      kind: 'reload',
      message: `${levelName}: ${LAYER_SAVE_MESSAGES.reload}`,
    });
    expect(Object.keys(apiClient)).not.toContain('resolveConflict');
  });
});
