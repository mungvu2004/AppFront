/**
 * B-V6-09 — mã A14 (`M-DIMN0000010`) không có số đếm ở sáu ký tự đầu, nên nhãn cũ
 * cho mọi hàng cùng một chữ và React báo trùng khoá. Hàng phải mang mã THỰC THỂ làm
 * khoá và một nhãn riêng, và duyệt một hàng chỉ đổi đúng thực thể ấy.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { createTestQueryClient } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { createMockDimensionOcrReviewGateway } from './dimensionOcrReviewGateway';
import { useDimensionOcrReview } from './useDimensionOcrReview';

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

describe('màn kích thước với mã bộ mẫu A14', () => {
  it('mỗi hàng có nhãn và khoá riêng; duyệt một hàng chỉ đổi đúng thực thể đó', async () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(
      () =>
        useDimensionOcrReview({
          projectId: 'project-1',
          floorId: 'floor-1',
          roles: ['engineer'],
          gateway: createMockDimensionOcrReviewGateway({ graph }),
          registry: createShortcutRegistry(),
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows.length).toBeGreaterThan(1);
    });

    const rows = result.current.rows;

    expect(rows.every((row) => row.id.startsWith('M-DIMN'))).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(new Set(rows.map((row) => row.codeLabel)).size).toBe(rows.length);

    const target = rows.find((row) => !row.isReviewed);

    expect(target).toBeDefined();

    const reviewedBefore = new Set(
      rows.filter((row) => row.isReviewed).map((row) => row.id),
    );

    await act(async () => {
      result.current.onApprove((target as { id: string }).id);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const reviewedAfter = result.current.rows.filter((row) => row.isReviewed).map((row) => row.id);

    expect(reviewedAfter).toHaveLength(reviewedBefore.size + 1);
    expect(reviewedAfter.filter((id) => !reviewedBefore.has(id))).toEqual([
      (target as { id: string }).id,
    ]);
  });
});
