import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient } from '@/api/__mocks__/client';
import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Wall, WallId } from '@/domain/spatial/types';
import { RETRY_SCHEDULE_MS } from '@/lib/autosave/retrySchedule';
import { setAuthenticatedSession } from '@/lib/auth/state';
import { useStore } from '@/store';
import { commit } from '@/store/commit';

import { __resetFloorLayerSavers, flushAutosaves, useFloorLayerAutosave } from './useAutosave';

/** Giả lỗi tải chunk: một trong ba ống của saver hỏng cho tới khi `chunk.down` tắt. */
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

describe('useFloorLayerAutosave — ống nạp hỏng (review F-04x-1 Nit-1)', () => {
  beforeEach(() => {
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

  it('import() hỏng → engine thử lại rồi báo "Lưu thất bại", rời trang vẫn cảnh báo; ống về lại → lượt sau lưu', async () => {
    const client = createMockApiClient();
    const writeLayer = vi.spyOn(client.spatial, 'writeLayer');
    const { result } = renderHook(() => useFloorLayerAutosave({ apiClient: client, floorId: FLOOR, projectId: PROJECT }));

    await tick();
    thicken();

    const leave = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);

    await tick(800);
    for (const delay of RETRY_SCHEDULE_MS) {
      await tick(delay);
    }

    expect(result.current.label).toBe('Lưu thất bại');
    expect(writeLayer).not.toHaveBeenCalled();

    chunk.down = false;
    thicken();
    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 0, floorId: FLOOR, projectId: PROJECT });
    expect(result.current.label).toMatch(/^Đã lưu lúc \d{2}:\d{2}$/);
  });
});
