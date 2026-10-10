/**
 * FIX-098/NO-099 — nhãn tiếng Việt của `ACTIVITY_KIND_LABELS` phải phủ đủ 27 `kind` mà
 * `ActivityKind` (`apps/api/access/kinds.py:21-47`) phát ra, không chỉ 11 mã cũ và phần lớn
 * không khớp mã BE nào (`'wall.edit'`, `'room.edit'`…).
 *
 * Danh sách 27 mã dưới đây CHÉP TĨNH từ `apps/api/access/kinds.py:21-47` (R-35: không đối
 * chiếu bằng cách nhập chính file Python, vì đây là bài kiểm TypeScript và mã Python không
 * nạp được ở đây) — đúng khuôn "kind chép tĩnh vào test kèm nguồn kinds.py:<dòng>" của T5.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type { AdminUser } from '@/api/schemas/users';
import { hasDiacritics } from '@/lib/testing/expectVietnamese';
import { createTestQueryClient } from '@/lib/testing/render';

import { FILTER_ALL } from './types';
import { buildPermissionMatrix } from './userManagementGateway';
import type { UserManagementGateway } from './userManagementGateway';
import { ACTIVITY_KIND_LABELS, useUserManagement } from './useUserManagement';

/** `apps/api/access/kinds.py:21-47`, đúng thứ tự khai báo. */
const BE_ACTIVITY_KINDS: readonly string[] = [
  'floor.upload',
  'floor.upload_complete',
  'floor.create',
  'floor.delete',
  'floor.edit',
  'floor.reorder',
  'project.create',
  'project.update',
  'project.delete',
  'project.settings_update',
  'member.add',
  'member.remove',
  'version.restore',
  'version.label',
  'rules.config_update',
  'user.role_change',
  'user.disable',
  'user.enable',
  'user.delete',
  'user.invite',
  'user.invite_resend',
  'model.activate',
  'model.upload',
  'dataset.create',
  'dataset.build',
  'training.create',
  'training.cancel',
];

describe('ACTIVITY_KIND_LABELS — FIX-098/NO-099', () => {
  it('đủ đúng 27 kind của kinds.py, không thiếu không thừa', () => {
    expect(BE_ACTIVITY_KINDS).toHaveLength(27);
    expect(Object.keys(ACTIVITY_KIND_LABELS).sort()).toEqual([...BE_ACTIVITY_KINDS].sort());
  });

  it.each(BE_ACTIVITY_KINDS)('mã "%s" có nhãn', (kind) => {
    expect(ACTIVITY_KIND_LABELS[kind]).toBeDefined();
  });

  it('mọi nhãn là tiếng Việt có dấu, viết hoa chữ đầu kiểu câu (A6)', () => {
    Object.values(ACTIVITY_KIND_LABELS).forEach((label) => {
      expect(hasDiacritics(label)).toBe(true);
      expect(label).toBe(label.charAt(0).toLocaleUpperCase('vi') + label.slice(1));
    });
  });

  it('mã BE cũ không có trong hợp đồng bị gỡ khỏi bảng (không còn "wall.edit")', () => {
    expect(ACTIVITY_KIND_LABELS['wall.edit']).toBeUndefined();
  });
});

describe('onClearSearch — BUG-082: lối thoát của khối không-khớp', () => {
  const NOW = Date.parse('2026-10-09T08:00:00Z');
  const USERS: AdminUser[] = [
    { email: 'an.pham@appfront.vn', id: 'u-an', lastActiveAt: null, name: 'Phạm An', projectCount: 2, role: 'admin', status: 'active' },
    { email: 'binh.nguyen@appfront.vn', id: 'u-binh', lastActiveAt: null, name: 'Nguyễn Bình', projectCount: 1, role: 'viewer', status: 'disabled' },
  ];

  function fakeGateway(): UserManagementGateway {
    const unused = (): Promise<never> => Promise.reject(new Error('Bài này không ghi.'));
    return {
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
      removeUser: unused,
      resendInvite: unused,
      createWriteTicket: () => {
        throw new Error('Bài này không ghi.');
      },
      notify: () => undefined,
      trackRoleChange: () => undefined,
      createOptimisticId: () => 'tam-1',
      now: () => NOW,
    };
  }

  it('xoá ô tìm VÀ đặt lại hai bộ lọc, nên danh sách đủ người trở lại', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useUserManagement({ gateway: fakeGateway() }), { wrapper });
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));

    act(() => {
      result.current.actions.onSearchChange('zzz');
      result.current.actions.onRoleFilterChange('admin');
      result.current.actions.onStatusFilterChange('disabled');
    });
    expect(result.current.model.rows).toHaveLength(0);

    act(() => {
      result.current.actions.onClearSearch();
    });
    expect(result.current.model.toolbar).toMatchObject({ search: '', roleFilter: FILTER_ALL, statusFilter: FILTER_ALL });
    expect(result.current.model.rows).toHaveLength(2);
  });
});
