import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Wall, WallId } from '@/domain/spatial/types';
import { setAuthenticatedSession } from '@/lib/auth/state';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { __resetFloorLayerSavers, flushAutosaves, useFloorLayerAutosave } from './useAutosave';

/** Ống chưa nạp xong lúc kho nhận lượt nạp máy chủ: giữ `import()` hỏng cho tới khi `chunk.down` tắt. */
const chunk = vi.hoisted(() => ({ down: true }));

vi.mock('@/lib/query/invalidation', async (importOriginal) => {
  if (chunk.down) {
    throw new Error('Failed to fetch dynamically imported module');
  }

  return importOriginal();
});

const PROJECT = 'project-1';
const SAMPLE = normalizeSpatial(createSampleBuilding());
const FLOOR = SAMPLE.byKind.level[0] as string;

const tick = async (ms = 0): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const thicken = (): void => {
  const spatial = useStore.getState().spatial;
  const wall = Object.values(spatial?.byId ?? {}).find(
    (entity): entity is Wall =>
      spatial?.byKind.wall.includes(entity.id as WallId) === true && 'levelId' in entity && entity.levelId === FLOOR,
  ) as Wall;

  act(() => {
    commit({ changes: { thicknessMm: wall.thicknessMm + 10 }, id: wall.id, kind: 'wall', op: 'update' }, 'Đổi độ dày');
  });
};

describe('useFloorLayerAutosave — lượt nạp máy chủ trước khi ống gắn (NO-359)', () => {
  beforeEach(() => {
    chunk.down = true;
    vi.useFakeTimers();
    __resetFloorLayerSavers();
    __resetMockLayerState();
    setAuthenticatedSession({ accessToken: 't', expiresAt: Date.now() + 3_600_000, roles: [], user: { id: 'u' } });
    useStore.getState().setSpatial(SAMPLE, 'v-1', {
      floorRevisions: Object.fromEntries(SAMPLE.byKind.level.map((id) => [id, 0])),
      projectId: PROJECT,
    });
  });

  afterEach(() => {
    __resetFloorLayerSavers();
    useStore.getState().setSpatial(null, null);
    vi.useRealTimers();
  });

  it('kho nạp lại đồ thị máy chủ trước khi ống gắn → không PUT thừa; sửa sau đó dùng revision mới (NO-359)', async () => {
    const client = createMockApiClient();
    const writeLayer = vi.spyOn(client.spatial, 'writeLayer');

    renderHook(() => useFloorLayerAutosave({ apiClient: client, floorId: FLOOR, projectId: PROJECT }));
    await tick();

    // Lượt nạp mang sửa của người khác ở tầng KHÁC — không phải sửa của người dùng này.
    const other = SAMPLE.byKind.level[1] as string;
    const remoteWall = Object.values(SAMPLE.byId).find(
      (entity): entity is Wall =>
        SAMPLE.byKind.wall.includes(entity.id as WallId) && 'levelId' in entity && entity.levelId === other,
    ) as Wall;
    const reloaded = {
      ...SAMPLE,
      byId: { ...SAMPLE.byId, [remoteWall.id]: { ...remoteWall, thicknessMm: remoteWall.thicknessMm + 50 } },
    };

    act(() => {
      useStore.getState().setSpatial(reloaded, 'v-2', {
        floorRevisions: Object.fromEntries(SAMPLE.byKind.level.map((id) => [id, 3])),
        projectId: PROJECT,
      });
    });

    chunk.down = false;
    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).not.toHaveBeenCalled();

    thicken();
    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 3, floorId: FLOOR, projectId: PROJECT });
  });
});
