import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { SAMPLE_BUILDING, sampleLevelId, sampleWallId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { __resetFloorLayerSavers, useFloorLayerAutosave } from '@/hooks/useAutosave';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { createPropertyInspectorGateway } from './propertyInspectorGateway';

const PROJECT = 'project-1';
const base = normalizeSpatial(SAMPLE_BUILDING);

/** Tường `index` của bộ mẫu nằm ở tầng `index % 4` — một lượt sửa thuộc tính qua `commit`. */
const thicken = (index: number, thicknessMm = 330): void => {
  act(() => {
    commit({ changes: { thicknessMm }, id: sampleWallId(index), kind: 'wall', op: 'update' }, 'Đổi độ dày');
  });
};

const settle = async (ms = 800): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/**
 * Đổi test (F-04x-1): cổng panel không còn `persistProperties` — sửa thuộc tính đi qua
 * saver lớp tầng dùng chung. Cùng các ý cũ (B-V8-41: mỗi tầng bị đổi một PUT; B-G-07:
 * `baseVersion` đúng), nay kiểm trên saver, với revision của lượt đọc thay cho N16.
 */
describe('sửa thuộc tính → saver lớp tầng: đích và baseVersion của lượt lưu', () => {
  const setup = async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const readLayer = vi.spyOn(apiClient.spatial, 'readLayer');

    renderHook(() => useFloorLayerAutosave({ apiClient, projectId: PROJECT }));
    await settle(0);

    const floors = (): string[] => writeLayer.mock.calls.map(([input]) => input.floorId);

    return { floors, readLayer, writeLayer };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    __resetFloorLayerSavers();
    __resetMockLayerState();
    useStore.getState().setSpatial(base, 'v-1', {
      floorRevisions: Object.fromEntries(base.byKind.level.map((id) => [id, 0])),
      projectId: PROJECT,
    });
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    useStore.getState().setSpatial(null, null);
    vi.useRealTimers();
  });

  it('cổng panel không còn tự lưu', () => {
    const gateway = createPropertyInspectorGateway({ apiClient: createMockApiClient() });

    expect(gateway).not.toHaveProperty('persistProperties');
    expect(gateway.supports).not.toHaveProperty('persistProperties');
  });

  it('sửa ở tầng 2 thì đúng một PUT, vào tầng 2', async () => {
    const { floors } = await setup();

    thicken(2);
    await settle();

    expect(floors()).toEqual([sampleLevelId(2)]);
  });

  it('sửa ở hai tầng thì hai PUT', async () => {
    const { floors } = await setup();

    thicken(1);
    thicken(3);
    await settle();

    expect([...floors()].sort()).toEqual([sampleLevelId(1), sampleLevelId(3)]);
  });

  it('sửa hai lần cùng một tầng: base lượt đầu là revision của lượt đọc, lượt sau là revision vừa ghi — N16 0 lần', async () => {
    const { readLayer, writeLayer } = await setup();

    thicken(2);
    await settle();
    thicken(2, 440);
    await settle();

    expect(readLayer).not.toHaveBeenCalled();
    expect(writeLayer.mock.calls.map(([input]) => input.baseVersion)).toEqual([0, 1]);
  });

  // Lượt lưu thay kho bằng bản máy chủ, nên ảnh hoàn tác khác tham chiếu ở cả L2: L2 gửi lại
  // đúng nội dung đã lưu (thừa, vô hại); điều phải đúng là L3 có mặt.
  it('hoàn tác một bước: tầng vừa đổi được gửi lại', async () => {
    const { floors, writeLayer } = await setup();

    thicken(2);
    thicken(3);
    await settle();
    writeLayer.mockClear();

    act(() => useStore.temporal.getState().undo());
    await settle();

    expect(floors()).toContain(sampleLevelId(3));
  });
});
