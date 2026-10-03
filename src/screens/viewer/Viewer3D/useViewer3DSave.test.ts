import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { sampleLevelId, sampleRoomId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { useViewer3DSave } from './useViewer3DSave';

/** Phòng 2 của bộ mẫu nằm ở tầng 2 (`index % 4`). */
const ROOM_INDEX = 2;

describe('useViewer3DSave — tự lưu cấp màn /3d (B-V8-60)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.getState().setProject({ created_at: '', id: 'P-1', members: [], name: 'P-1', updated_at: '' });
    useStore.getState().setSpatial(normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph), 'v-test');
  });

  afterEach(() => {
    vi.useRealTimers();
    useStore.getState().setProject(null);
  });

  it('không panel nào dựng: đổi tên một phòng vẫn gửi đúng tầng của phòng ấy, và nói giờ lưu', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');
    const { result } = renderHook(() => useViewer3DSave(apiClient));

    act(() => {
      commit({ changes: { name: 'Phòng mới' }, id: sampleRoomId(ROOM_INDEX), kind: 'room', op: 'update' }, 'đổi tên');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(writeLayer.mock.calls.map(([input]) => input.floorId)).toEqual([sampleLevelId(ROOM_INDEX)]);
    expect(result.current).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
  });
});
