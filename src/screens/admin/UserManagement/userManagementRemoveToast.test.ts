/**
 * [37W-A-018] SCR-37 xoá hẳn: toast "Đã xoá tài khoản" có mô tả = email CỦA TÀI KHOẢN (BE lưu chữ thường),
 * kể cả khi người dùng gõ khác hoa/thường và thừa khoảng trắng (catalog-C5.md:30; UUM so khớp trim().toLowerCase()).
 * Gửi lên BE vẫn là `removeEmail.trim()` (giữ hoa/thường người gõ — N9).
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/api/schemas/users';
import { createTestQueryClient } from '@/lib/testing/render';

import { buildPermissionMatrix } from './userManagementGateway';
import type { UserManagementGateway } from './userManagementGateway';
import { useUserManagement } from './useUserManagement';

const NOW = Date.parse('2026-10-09T08:00:00Z');
const USERS: AdminUser[] = [
  { email: 'an.pham@appfront.vn', id: 'u-an', lastActiveAt: null, name: 'Phạm An', projectCount: 2, role: 'admin', status: 'active' },
  { email: 'binh.nguyen@appfront.vn', id: 'u-binh', lastActiveAt: null, name: 'Nguyễn Bình', projectCount: 1, role: 'viewer', status: 'active' },
];

describe('[37W-A-018] toast xoá hẳn', () => {
  it('mô tả là email của tài khoản (chữ thường), dù đã gõ HOA + khoảng trắng; BE nhận chữ đã trim', async () => {
    const notify = vi.fn();
    const removeUser = vi.fn(() => Promise.resolve(USERS[1] as AdminUser));
    const unused = (): Promise<never> => Promise.reject(new Error('Bài này không ghi.'));
    const gateway: UserManagementGateway = {
      capabilities: { canManageUsers: true },
      currentUserId: 'u-an',
      currentUserEmail: 'an.pham@appfront.vn',
      permissionMatrix: buildPermissionMatrix(),
      listUsers: () => Promise.resolve({ total: USERS.length, users: USERS }),
      readMemberships: () => Promise.resolve([]),
      readActivity: () => Promise.resolve([]),
      changeRole: unused,
      disableUser: unused,
      enableUser: unused,
      inviteUsers: unused,
      removeUser,
      resendInvite: unused,
      createWriteTicket: () => {
        throw new Error('Bài này không ghi.');
      },
      notify,
      trackRoleChange: () => undefined,
      createOptimisticId: () => 'tam-1',
      now: () => NOW,
    };
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useUserManagement({ gateway }), { wrapper });
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));

    act(() => {
      result.current.actions.onOpenRemove('u-binh');
    });
    act(() => {
      result.current.actions.onRemoveEmailChange('  BINH.NGUYEN@APPFRONT.VN ');
    });
    act(() => {
      result.current.actions.onConfirmRemove();
    });

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(removeUser).toHaveBeenCalledWith({ userId: 'u-binh', confirmEmail: 'BINH.NGUYEN@APPFRONT.VN' });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'user.remove', description: 'binh.nguyen@appfront.vn' }));
  });
});
