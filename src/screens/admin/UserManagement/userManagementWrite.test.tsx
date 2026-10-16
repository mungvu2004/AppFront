/**
 * Phase 08, SCR-37 phía ghi — BUG-P08-022 … 027 và Q5 (questions.md: "Gửi lại" ở MỌI hàng chờ).
 * Hàng catalog: 37W-C-013/014, 37W-G-015, 37W-G-002, 37W-E-010, 37W-E-004, 37W-C-005, 37W-C-007, 37W-B-006.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminUser } from '@/api/schemas/users';
import { describeError, toAppError } from '@/lib/errors';
import { createTestQueryClient, renderWithProviders } from '@/lib/testing/render';

import type { UserManagementActions, UserManagementViewModel } from './types';
import { USER_MANAGEMENT_SCENARIO_SUCCESS } from './userManagementScenarios';
import { UserManagement } from './UserManagement';
import { buildPermissionMatrix, createUserManagementGateway, parseInviteEmails } from './userManagementGateway';
import type { UserManagementGateway } from './userManagementGateway';
import { USER_MANAGEMENT_TEXT, useUserManagement } from './useUserManagement';

afterEach(() => {
  cleanup();
});

const NOW = Date.parse('2026-10-16T02:00:00Z');
const user = (id: string, role: AdminUser['role'], extra: Partial<AdminUser> = {}): AdminUser => ({
  email: `${id}@x.test`,
  id,
  lastActiveAt: null,
  name: id,
  projectCount: 0,
  role,
  status: 'active',
  ...extra,
});

function fakeGateway(users: AdminUser[], overrides: Partial<UserManagementGateway> = {}): UserManagementGateway {
  const unused = (): Promise<never> => Promise.reject(new Error('Bài này không ghi.'));
  return {
    capabilities: { canManageUsers: true },
    currentUserId: 'me',
    currentUserEmail: 'me@x.test',
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

function mountHook(gateway: UserManagementGateway) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { readonly children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(() => useUserManagement({ gateway }), { wrapper });
}

describe('BUG-P08-022: nút "Xoá" của chính mình', () => {
  it('[37W-C-013] hàng của mình (còn >= 2 quản trị) mang lý do chặn, người khác thì không', async () => {
    const { result } = mountHook(fakeGateway([user('me', 'admin'), user('other', 'admin'), user('eng', 'engineer')]));
    await waitFor(() => expect(result.current.model.rows).toHaveLength(3));
    const reason = (id: string) => result.current.model.rows.find((row) => row.id === id)?.removeBlockedReason;

    expect(reason('me')).toBe(USER_MANAGEMENT_TEXT.selfRemoveBlocked);
    expect(reason('other')).toBeNull();
    expect(reason('eng')).toBeNull();
  });

  it('[37W-F-007] mình + quản trị cuối: isSelf thắng lastAdmin; người khác là quản trị cuối giữ câu lastAdmin', async () => {
    const solo = mountHook(fakeGateway([user('me', 'admin')]));
    await waitFor(() => expect(solo.result.current.model.rows).toHaveLength(1));
    expect(solo.result.current.model.rows[0]?.removeBlockedReason).toBe(USER_MANAGEMENT_TEXT.selfRemoveBlocked);

    const other = mountHook(fakeGateway([user('me', 'engineer'), user('boss', 'admin')]));
    await waitFor(() => expect(other.result.current.model.rows).toHaveLength(2));
    expect(other.result.current.model.rows.find((row) => row.id === 'boss')?.removeBlockedReason).toBe(
      USER_MANAGEMENT_TEXT.lastAdminBlocked,
    );
  });

  it('[37W-C-014] panel chi tiết: có lý do chặn thì hiện chữ, không có nút "Xoá" của mục xoá', () => {
    const row = { ...USER_MANAGEMENT_SCENARIO_SUCCESS.rows[0]!, removeBlockedReason: USER_MANAGEMENT_TEXT.selfRemoveBlocked };
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      rows: [],
      detail: { user: row, memberships: [], activities: [] },
    };
    renderWithProviders(<UserManagement actions={noActions()} model={model} />);

    const section = screen.getByRole('region', { name: 'Xoá người dùng' });
    expect(section).toHaveTextContent(USER_MANAGEMENT_TEXT.selfRemoveBlocked);
    expect(section.querySelector('button')).toBeNull();
  });
});

function noActions(overrides: Partial<UserManagementActions> = {}): UserManagementActions {
  const fn = vi.fn();
  return {
    onSearchChange: fn, onClearSearch: fn, onRoleFilterChange: fn, onStatusFilterChange: fn, onSelectUser: fn,
    onChangeRole: fn, onChangeMembershipRole: fn, onDisableUser: fn, onEnableUser: fn, onResendInvite: fn,
    onOpenInvite: fn, onCloseInvite: fn, onInviteEmailsChange: fn, onInviteRoleChange: fn, onSubmitInvite: fn,
    onOpenRemove: fn, onCloseRemove: fn, onRemoveEmailChange: fn, onConfirmRemove: fn,
    onOpenPermissionReference: fn, onClosePermissionReference: fn, onRetry: fn,
    ...overrides,
  };
}

describe('BUG-P08-023: lời mời 429 không tự gửi lại', () => {
  it('[37W-G-002] inviteUsers và resendInvite bật failFastOnRateLimit', async () => {
    const ok = (data: unknown) => vi.fn().mockResolvedValue({ ok: true, data });
    const usersApi = { invite: ok([]), resendInvite: ok(user('a', 'viewer')) };
    const gateway = createUserManagementGateway({
      usersApi: usersApi as never,
      roles: ['admin'],
      notifications: { publish: vi.fn() } as never,
    });

    await gateway.inviteUsers({ emails: ['a@x.test'], role: 'viewer' } as never);
    await gateway.resendInvite('a');

    expect(usersApi.invite).toHaveBeenCalledWith(expect.objectContaining({ failFastOnRateLimit: true }));
    expect(usersApi.resendInvite).toHaveBeenCalledWith(expect.objectContaining({ failFastOnRateLimit: true }));
  });
});

describe('Q5 + BUG-P08-024: "Gửi lại" ở mọi hàng chờ, tên truy cập nêu người nhận', () => {
  it('[37W-B-006][37W-E-010] hàng chờ còn hạn cũng có nút, mỗi nút có tên riêng', () => {
    const base = USER_MANAGEMENT_SCENARIO_SUCCESS.rows[0]!;
    const pending = (id: string, inviteExpired: boolean) => ({
      ...base, id, email: `${id}@x.test`, name: id, status: 'pending' as const, inviteExpired, canResendInvite: true,
    });
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      rows: [pending('con-han', false), pending('het-han', true)],
      detail: null,
    };
    const onResendInvite = vi.fn();
    renderWithProviders(<UserManagement actions={noActions({ onResendInvite })} model={model} />);

    for (const id of ['con-han', 'het-han']) {
      expect(screen.getByRole('button', { name: `Gửi lại lời mời cho ${id}@x.test` })).toBeInTheDocument();
    }
  });
});

describe('BUG-P08-025: mở khối mời đưa focus vào ô email', () => {
  it('[37W-E-004] ô "Email người được mời" có focus khi khối mời mở', () => {
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      detail: null,
      invite: { ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite, isOpen: true },
    };
    renderWithProviders(<UserManagement actions={noActions()} model={model} />);

    expect(screen.getByRole('textbox', { name: 'Email người được mời' })).toHaveFocus();
  });
});

describe('FL-37W-01: Esc khi đang gõ trong ô mời', () => {
  it('[37W-E-003] Esc trong ô email giữ khối mời; Esc ngoài ô đóng khối', () => {
    const actions = noActions();
    const model: UserManagementViewModel = {
      ...USER_MANAGEMENT_SCENARIO_SUCCESS,
      detail: null,
      invite: { ...USER_MANAGEMENT_SCENARIO_SUCCESS.invite, isOpen: true },
    };
    renderWithProviders(<UserManagement actions={actions} model={model} />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Email người được mời' }), { key: 'Escape' });
    expect(actions.onCloseInvite).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Huỷ' }), { key: 'Escape' });
    expect(actions.onCloseInvite).toHaveBeenCalledTimes(1);
  });
});

describe('FL-37W-03: đổi vai trên hàng đã bị xoá (404)', () => {
  it('[37W-G-008] toast lỗi mang câu của kind notFound dù mã BE là USER_NOT_FOUND', async () => {
    const notify = vi.fn();
    const error = { kind: 'http', status: 404, code: 'USER_NOT_FOUND', requestId: 'r1', retryable: false, message: 'gone', raw: {} };
    const { result } = mountHook(
      fakeGateway([user('me', 'admin'), user('gone', 'viewer')], { changeRole: () => Promise.reject(error), notify }),
    );
    await waitFor(() => expect(result.current.model.rows).toHaveLength(2));

    act(() => result.current.actions.onChangeRole('gone', 'engineer'));

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: USER_MANAGEMENT_TEXT.roleChangeFailedTitle,
        description: describeError(toAppError(error)).description,
      }),
    );
    expect(describeError(toAppError(error)).description).toBe(describeError(toAppError({ ...error, code: undefined })).description); // kind notFound by status, whatever the code
  });
});

describe('BUG-P08-026: khử trùng email không phân biệt hoa thường', () => {
  it('[37W-C-005] "A@x.test" + "a@x.test" chỉ đếm 1, giữ lần gặp đầu', () => {
    expect(parseInviteEmails('A@x.test, a@x.test\nB@x.test').validEmails).toEqual(['A@x.test', 'B@x.test']);
  });
});

describe('BUG-P08-027: lỗi field "emails" gắn vào ô nhập', () => {
  it('[37W-C-007] 422 field emails: toast chung giữ nguyên, ô email có errorLabel, sửa chữ thì tắt', async () => {
    const notify = vi.fn();
    const error = {
      kind: 'http', status: 422, code: 'USER_EMAIL_TAKEN', requestId: 'r1', retryable: false,
      message: 'taken', raw: { field: 'emails' },
    };
    const { result } = mountHook(
      fakeGateway([user('me', 'admin')], { inviteUsers: () => Promise.reject(error), notify }),
    );
    await waitFor(() => expect(result.current.model.rows).toHaveLength(1));

    act(() => {
      result.current.actions.onOpenInvite();
      result.current.actions.onInviteEmailsChange('me@x.test');
    });
    expect(result.current.model.invite.errorLabel).toBeNull();

    act(() => result.current.actions.onSubmitInvite());
    await waitFor(() => expect(notify).toHaveBeenCalled());
    await waitFor(() => expect(result.current.model.invite.errorLabel).not.toBeNull());
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ title: USER_MANAGEMENT_TEXT.inviteFailedTitle }));

    act(() => result.current.actions.onInviteEmailsChange('moi@x.test'));
    expect(result.current.model.invite.errorLabel).toBeNull();
  });
});

describe('FL-37W-02: bấm đúp "Gửi lời mời"', () => {
  it('[37W-B-001] hai lần bấm liền nhau chỉ gửi MỘT lượt mời', async () => {
    let answer: (users: readonly AdminUser[]) => void = () => undefined;
    const inviteUsers = vi.fn(() => new Promise<readonly AdminUser[]>((resolve) => { answer = resolve; })); // held, then answered
    const { result } = mountHook(
      fakeGateway([user('me', 'admin')], { inviteUsers, createWriteTicket: () => { throw new Error('x'); } }),
    );
    await waitFor(() => expect(result.current.model.rows).toHaveLength(1));
    act(() => {
      result.current.actions.onOpenInvite();
      result.current.actions.onInviteEmailsChange('moi@x.test');
    });
    const { onSubmitInvite } = result.current.actions; // the handler a double-click holds for both clicks

    act(() => {
      onSubmitInvite();
      onSubmitInvite();
    });
    await waitFor(() => expect(inviteUsers).toHaveBeenCalled());
    act(() => answer([user('moi', 'viewer', { status: 'pending' })]));
    // the mutation queue runs a 2nd lifecycle after the 1st answers: on the wire that is the 2nd POST (evidence postCount 2)
    await waitFor(() => expect(result.current.model.invite.isOpen).toBe(false)); // 1st answered: form closed
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); // let the queued 2nd lifecycle start if it exists
    expect(inviteUsers).toHaveBeenCalledTimes(1);
  });

  it('[37W-A-003] sau khi một lượt mời lỗi, bấm gửi lại vẫn gửi được (cờ đang gửi đã nhả)', async () => {
    const inviteUsers = vi.fn(() => Promise.reject(new Error('boom')));
    const { result } = mountHook(fakeGateway([user('me', 'admin')], { inviteUsers }));
    await waitFor(() => expect(result.current.model.rows).toHaveLength(1));
    act(() => {
      result.current.actions.onOpenInvite();
      result.current.actions.onInviteEmailsChange('moi@x.test');
    });
    act(() => result.current.actions.onSubmitInvite());
    await waitFor(() => expect(inviteUsers).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.model.invite.isSubmitting).toBe(false));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    act(() => result.current.actions.onSubmitInvite());
    await waitFor(() => expect(inviteUsers).toHaveBeenCalledTimes(2));
  });
});
