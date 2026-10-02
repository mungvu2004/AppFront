/**
 * B-V6-09 — mã tường của BE (ULID, `W-01J9ZV8Q…`) có sáu ký tự đầu là mốc thời gian
 * chung của cả lượt dựng, nên nhãn cũ cho mọi đoạn cùng một chữ. Mỗi dòng bảng phải
 * có nhãn riêng; khoá dòng vẫn là mã thực thể.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Wall, WallId } from '@/domain/spatial/types';
import { createTestQueryClient } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';
import { createHistoryStack } from '@/lib/commands/history';

import { THICKNESS_FIXTURE_LEVELS, THICKNESS_FIXTURE_WALLS } from './thicknessFixture';
import {
  createMockThicknessStandardizationGateway,
  thicknessGraphOf,
} from './thicknessStandardizationGateway';
import { useThicknessStandardization } from './useThicknessStandardization';

const ULID_IDS = [
  'W-01J9ZV8Q3M7X5B2N4K6P8R0T1A',
  'W-01J9ZV8Q3M7X5B2N4K6P8R0T2B',
  'W-01J9ZV8Q3M7X5B2N4K6P8R0T3C',
] as const;

const walls: readonly Wall[] = ULID_IDS.map((id, index) => ({
  ...(THICKNESS_FIXTURE_WALLS[index] as Wall),
  id: id as WallId,
}));

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

describe('màn chuẩn hoá độ dày với mã ULID của BE', () => {
  it('mỗi dòng bảng có nhãn riêng và mang mã thực thể', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () =>
        useThicknessStandardization({
          projectId: 'project-1',
          floorId: THICKNESS_FIXTURE_LEVELS[0]?.id ?? '',
          roles: ['engineer'],
          gateway: createMockThicknessStandardizationGateway({
            graph: thicknessGraphOf(walls, THICKNESS_FIXTURE_LEVELS),
          }),
          history: createHistoryStack(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.segmentRows).toHaveLength(ULID_IDS.length);
    });

    const rows = result.current.segmentRows;

    expect(rows.map((row) => row.wallId).sort()).toEqual([...ULID_IDS]);
    expect(new Set(rows.map((row) => row.code)).size).toBe(ULID_IDS.length);
    expect(rows.map((row) => row.code).sort()).toEqual(['#W-001', '#W-002', '#W-003']);
  });
});
