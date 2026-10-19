/**
 * QA-09 F-11 (9P-D-401..403, 9A-D-009): quyền quản lý thư viện model theo vai của PHIÊN
 * (toàn cục, duy nhất), không theo `store.userRoles` của dự án mở trước.
 */
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { renderWithProviders } from '../renderWithRouter';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { ModelLibraryContainer } from './ModelLibrary.container';
import { MODEL_LIBRARY_TEXT } from './useModelLibrary';

const auth = vi.hoisted(() => ({ roles: ['admin'] as readonly string[] }));

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    roles: auth.roles,
    status: 'authenticated',
    user: { id: 'u-test', name: 'Quân' },
  }),
}));
vi.mock('@/api/appClient', () => ({ createAppApiClient: () => createMockApiClient() }));

function open(sessionRoles: readonly ProjectRole[], storeRoles: readonly ProjectRole[]): void {
  auth.roles = sessionRoles;
  /* eslint-disable-next-line local/no-direct-set -- dựng store.userRoles cũ của dự án trước (F-11), không có lệnh commit nào đặt vai thẳng. */
  useStore.setState({ userRoles: storeRoles });
  renderWithProviders(<ModelLibraryContainer />, { keepStore: true });
}

afterEach(() => {
  cleanup();
  /* eslint-disable-next-line local/no-direct-set -- đưa store về trạng thái đầu giữa các ca. */
  useStore.setState({ userRoles: [] });
});

describe('[9P-D-401][9A-D-009] vai phiên là nguồn quyền thư viện model', () => {
  it.each([['engineer'], ['viewer']] as const)(
    'phiên admin + store.userRoles=%s: KHÔNG hiện cảnh báo chỉ đọc',
    async (storeRole) => {
      open(['admin'], [storeRole]);
      // Chờ danh sách đã tải (hàng đầu của dữ liệu mẫu) rồi mới khẳng định "không có cảnh báo".
      await screen.findByText('bàn ăn sáu chỗ');
      expect(screen.queryByText(MODEL_LIBRARY_TEXT.readOnlyReason)).toBeNull();
    },
  );

  it('[9P-D-402][9P-D-403] phiên engineer + store.userRoles=admin: vẫn chỉ đọc', async () => {
    open(['engineer'], ['admin']);
    expect(await screen.findByText(MODEL_LIBRARY_TEXT.readOnlyReason)).toBeTruthy();
  });
});
