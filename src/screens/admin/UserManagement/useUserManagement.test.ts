/**
 * FIX-098/NO-099 — nhãn tiếng Việt của `ACTIVITY_KIND_LABELS` phải phủ đủ 27 `kind` mà
 * `ActivityKind` (`apps/api/access/kinds.py:21-47`) phát ra, không chỉ 11 mã cũ và phần lớn
 * không khớp mã BE nào (`'wall.edit'`, `'room.edit'`…).
 *
 * Danh sách 27 mã dưới đây CHÉP TĨNH từ `apps/api/access/kinds.py:21-47` (R-35: không đối
 * chiếu bằng cách nhập chính file Python, vì đây là bài kiểm TypeScript và mã Python không
 * nạp được ở đây) — đúng khuôn "kind chép tĩnh vào test kèm nguồn kinds.py:<dòng>" của T5.
 */
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
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

describe('SCR-37 đọc — BUG-P08-015/016: trạng thái đọc của panel chi tiết và ô rỗng khổ hẹp', () => {
  const NOW = Date.parse('2026-10-09T08:00:00Z');
  const ADMIN: AdminUser = { email: 'an.pham@appfront.vn', id: 'u-an', lastActiveAt: null, name: 'Phạm An', projectCount: 0, role: 'admin', status: 'active' };
  const VIEWER: AdminUser = { email: 'binh.nguyen@appfront.vn', id: 'u-binh', lastActiveAt: null, name: 'Nguyễn Bình', projectCount: 0, role: 'viewer', status: 'active' };

  function gatewayWith(users: AdminUser[], overrides: Partial<UserManagementGateway>): UserManagementGateway {
    const unused = (): Promise<never> => Promise.reject(new Error('Bài này không ghi.'));
    return {
      capabilities: { canManageUsers: true },
      currentUserId: 'u-an',
      currentUserEmail: ADMIN.email,
      permissionMatrix: buildPermissionMatrix(),
      listUsers: () => Promise.resolve({ total: users.length, users }),
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
      ...overrides,
    };
  }

  function mount(gateway: UserManagementGateway, isNarrow = false) {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    return renderHook(() => useUserManagement({ gateway, isNarrow }), { wrapper });
  }

  it('[37U-B-017] memberships/activity chưa có dữ liệu: trạng thái "loading", không phải rỗng', async () => {
    const never = (): Promise<never> => new Promise<never>(() => undefined);
    const { result } = mount(gatewayWith([ADMIN, VIEWER], { readMemberships: never, readActivity: never }));
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));
    act(() => result.current.actions.onSelectUser('u-binh'));
    await waitFor(() => expect(result.current.model.detail).not.toBeNull());
    expect(result.current.model.detail?.membershipsState).toEqual({ status: 'loading' });
    expect(result.current.model.detail?.activitiesState).toEqual({ status: 'loading' });
  });

  it('[37U-B-015/016, G-005] memberships 404 và activity 500: trạng thái "error" kèm câu lỗi', async () => {
    const { result } = mount(
      gatewayWith([ADMIN, VIEWER], {
        readMemberships: () => Promise.reject(new Error('404 không thấy')),
        readActivity: () => Promise.reject(new Error('500 hỏng')),
      }),
    );
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));
    act(() => result.current.actions.onSelectUser('u-binh'));
    await waitFor(() => expect(result.current.model.detail?.membershipsState?.status).toBe('error'));
    await waitFor(() => expect(result.current.model.detail?.activitiesState?.status).toBe('error'));
    const state = result.current.model.detail?.membershipsState;
    expect(state?.status === 'error' && state.label.length > 0).toBe(true);
  });

  it('[37U-B-015] đọc xong: trạng thái "ready"', async () => {
    const { result } = mount(gatewayWith([ADMIN, VIEWER], {}));
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));
    act(() => result.current.actions.onSelectUser('u-binh'));
    await waitFor(() => expect(result.current.model.detail?.membershipsState).toEqual({ status: 'ready' }));
    expect(result.current.model.detail?.activitiesState).toEqual({ status: 'ready' });
  });

  it('[37U-G-007] mất mạng khi mở chi tiết: lượt đọc bị TanStack tạm dừng, panel vẫn báo "error" (không kẹt "loading")', async () => {
    const { result } = mount(gatewayWith([ADMIN, VIEWER], {}));
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));
    onlineManager.setOnline(false);
    try {
      act(() => result.current.actions.onSelectUser('u-binh'));
      await waitFor(() => expect(result.current.model.detail?.membershipsState?.status).toBe('error'));
      expect(result.current.model.detail?.activitiesState?.status).toBe('error');
      // Có mạng lại: lượt đọc chạy tiếp và panel về "ready" (không kẹt lỗi).
      act(() => onlineManager.setOnline(true));
      await waitFor(() => expect(result.current.model.detail?.membershipsState).toEqual({ status: 'ready' }));
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('[37U-C-011] chỉ có mình admin: "empty" ở cả khổ rộng và khổ hẹp (<1024)', async () => {
    const wide = mount(gatewayWith([ADMIN], {}), false);
    await waitFor(() => expect(wide.result.current.model.state).toBe('empty'));
    const narrow = mount(gatewayWith([ADMIN], {}), true);
    await waitFor(() => expect(narrow.result.current.model.state).toBe('empty'));
  });

  it('[37U-C-011] khổ hẹp có người khác: vẫn "collapsed"', async () => {
    const narrow = mount(gatewayWith([ADMIN, VIEWER], {}), true);
    await waitFor(() => expect(narrow.result.current.model.state).toBe('collapsed'));
  });
});
