/**
 * QA-08 BUG-P08-002 (34L-B-031/032): vai chỉ xem (canManage=false) phải thấy `loading` khi đang
 * tải và `error` khi đọc lỗi; `forbidden` chỉ khi đọc xong. Đọc thư viện mở cho mọi vai (Q1).
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { LibraryItem } from '@/api/client';
import { createTestQueryClient } from '@/lib/testing/render';

import type { ModelLibraryCapabilities, ModelLibraryGateway } from './types';
import { MODEL_LIBRARY_TEXT, useModelLibrary } from './useModelLibrary';

const CAPS: ModelLibraryCapabilities = {
  canPreview3d: false,
  canFlagHeavy: false,
  canManage: false,
  canUploadModel: false,
  canChangeGroup: false,
  canDeprecate: false,
  canDelete: false,
  canOptimizeMesh: false,
  canCountUsage: false,
  canListAliases: false,
  canShowProvenance: false,
  canAutoSpin: false,
};

function render(
  listModels: ModelLibraryGateway['listModels'],
  canManage: boolean,
): ReturnType<typeof renderHook<ReturnType<typeof useModelLibrary>, unknown>> {
  const gateway: ModelLibraryGateway = {
    capabilities: { ...CAPS, canManage },
    listModels,
    readModel: () => Promise.reject(new Error('không dùng')),
  };
  const client = createTestQueryClient();
  const wrapper = ({ children }: { readonly children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useModelLibrary({ gateway }), { wrapper });
}

describe('state của người chỉ xem (BUG-P08-002)', () => {
  it('[34L-B-031] đang tải: "loading", không phải "forbidden"', () => {
    const { result } = render(() => new Promise<readonly LibraryItem[]>(() => undefined), false);

    expect(result.current[0].state).toBe('loading');
  });

  it('[34L-B-032] đọc lỗi: "error" kèm errorMessage, không phải bảng rỗng', async () => {
    const { result } = render(() => Promise.reject(new Error('5xx')), false);

    await waitFor(() => {
      expect(result.current[0].state).toBe('error');
    });
    expect(result.current[0].errorMessage).not.toBeNull();
  });

  it('đọc xong: vẫn "forbidden" (chỉ xem) kèm readOnlyReason', async () => {
    const { result } = render(() => Promise.resolve([]), false);

    await waitFor(() => {
      expect(result.current[0].state).toBe('forbidden');
    });
    expect(result.current[0].readOnlyReason).toBe(MODEL_LIBRARY_TEXT.readOnlyReason);
  });

  it('admin: đang tải vẫn "loading"', () => {
    const { result } = render(() => new Promise<readonly LibraryItem[]>(() => undefined), true);

    expect(result.current[0].state).toBe('loading');
  });
});
