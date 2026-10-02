/**
 * B-V6-09 — mã phòng của BE (ULID, `R-01J9ZV8Q…`) có sáu ký tự đầu là mốc thời gian
 * chung của cả lượt dựng, nên nhãn cũ cho mọi phòng cùng một chữ. Mỗi phòng phải có
 * nhãn riêng, và chọn một phòng phải chọn đúng phòng đó.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Room, RoomId } from '@/domain/spatial/types';
import { createTestQueryClient } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import {
  ROOM_LABEL_FIXTURE_BUILDING,
  ROOM_LABEL_FIXTURE_LEVEL,
  ROOM_LABEL_FIXTURE_ROOMS,
} from './roomLabelFixture';
import { createMockRoomLabelReviewGateway } from './roomLabelReviewGateway';
import { useRoomLabelReview } from './useRoomLabelReview';

const ULID_IDS = [
  'R-01J9ZV8Q3M7X5B2N4K6P8R0T1A',
  'R-01J9ZV8Q3M7X5B2N4K6P8R0T2B',
  'R-01J9ZV8Q3M7X5B2N4K6P8R0T3C',
] as const;

const rooms: readonly Room[] = ULID_IDS.map((id, index) => ({
  ...(ROOM_LABEL_FIXTURE_ROOMS[index] as Room),
  id: id as RoomId,
}));

const graph = normalizeSpatial({
  building: ROOM_LABEL_FIXTURE_BUILDING,
  levels: [ROOM_LABEL_FIXTURE_LEVEL],
  walls: [],
  openings: [],
  furniture: [],
  rooms: [...rooms],
  axes: [],
  dimensions: [],
  notes: [],
});

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  const store = useStore.getState();

  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
  vi.restoreAllMocks();
});

describe('màn duyệt tên phòng với mã ULID của BE', () => {
  it('mỗi phòng có nhãn riêng, và chọn một phòng chọn đúng phòng đó', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () =>
        useRoomLabelReview({
          projectId: 'project-1',
          floorId: ROOM_LABEL_FIXTURE_LEVEL.id,
          roles: ['engineer'],
          gateway: createMockRoomLabelReviewGateway({ graph }),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rooms).toHaveLength(ULID_IDS.length);
    });

    const labels = result.current.rooms.map((room) => room.codeLabel);

    expect(new Set(labels).size).toBe(ULID_IDS.length);
    expect(labels).toEqual(['#R-001', '#R-002', '#R-003']);

    act(() => {
      result.current.onSelect(ULID_IDS[1] as RoomId);
    });

    await waitFor(() => {
      expect(result.current.selectedRoomId).toBe(ULID_IDS[1]);
    });

    expect(result.current.mergeCandidates.map((candidate) => candidate.codeLabel)).toEqual([
      '#R-001',
      '#R-003',
    ]);
  });
});
