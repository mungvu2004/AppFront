import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { queryKeys } from '@/lib/query/queryKeys';

import { MembersTab, type MembersTabProps } from './MembersTab';
import { createProjectSettingsGateway } from './projectSettingsGateway';
import {
  ADMIN_USER,
  ENGINEER_USER,
  NEWCOMER_USER,
  PROJECT_ID,
  createFakeServer,
  createHookWrapper,
  httpError,
  installMatchMedia,
  networkError,
  type FakeServer,
} from './settingsTestKit';
import { useProjectSettings, type UseProjectSettingsOptions } from './useProjectSettings';

beforeAll(() => {
  installMatchMedia();
});

afterEach(() => {
  cleanup();
});

const noop = (): void => undefined;

function tabProps(overrides: Partial<MembersTabProps> = {}): MembersTabProps {
  return {
    state: 'success',
    canEdit: true,
    members: [
      { id: 'usr_admin', name: 'Phạm An', roleLabel: 'quản trị', initials: 'PA', removeLabel: 'Gỡ Phạm An' },
      { id: 'usr_eng', name: 'Nguyễn Bình', roleLabel: 'kỹ sư', initials: 'NB', removeLabel: 'Gỡ Nguyễn Bình' },
    ],
    memberCountLabel: '2 thành viên',
    memberEmail: '',
    memberError: null,
    isAddingMember: false,
    isAddMemberLocked: false,
    memberRemoveDialog: null,
    setMemberEmail: noop,
    addMember: noop,
    requestRemoveMember: noop,
    confirmRemoveMember: noop,
    cancelRemoveMember: noop,
    ...overrides,
  };
}

describe('MembersTab (view)', () => {
  it('không còn câu "chỉ để xem trong bản này"', () => {
    render(<MembersTab {...tabProps()} />);

    expect(screen.queryByText(/chỉ để xem/u)).not.toBeInTheDocument();
    expect(screen.getByText('2 thành viên')).toBeInTheDocument();
  });

  it('canEdit: ô email có nhãn, nút thêm, và mỗi dòng một nút gỡ có tên người trong nhãn', () => {
    render(<MembersTab {...tabProps()} />);

    expect(screen.getByRole('textbox', { name: viMessages.project.settings.members.emailLabel })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: viMessages.project.settings.members.addAction })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gỡ Phạm An' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gỡ Nguyễn Bình' })).toBeInTheDocument();
  });

  it('!canEdit: ô, nút thêm và nút gỡ rời khỏi DOM, danh sách vẫn đọc được', () => {
    render(<MembersTab {...tabProps({ canEdit: false })} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Phạm An')).toBeInTheDocument();
  });

  it('gõ email, bấm thêm và gửi biểu mẫu đều gọi hành động của hook', () => {
    const setMemberEmail = vi.fn();
    const addMember = vi.fn();
    render(<MembersTab {...tabProps({ setMemberEmail, addMember })} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: viMessages.project.settings.members.addAction }));

    expect(setMemberEmail).toHaveBeenCalledWith('a@example.com');
    expect(addMember).toHaveBeenCalledTimes(1);
  });

  it('lỗi hiện dưới ô, và nút thêm khoá khi bị giới hạn tần suất', () => {
    render(
      <MembersTab
        {...tabProps({ memberError: viMessages.project.settings.members.rateLimited, isAddMemberLocked: true })}
      />,
    );

    expect(screen.getByText(viMessages.project.settings.members.rateLimited)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: viMessages.project.settings.members.addAction })).toBeDisabled();
  });

  it('nút gỡ báo mã người cần gỡ', () => {
    const requestRemoveMember = vi.fn();
    render(<MembersTab {...tabProps({ requestRemoveMember })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Gỡ Nguyễn Bình' }));

    expect(requestRemoveMember).toHaveBeenCalledWith('usr_eng');
  });

  it('hộp thoại gỡ: có lỗi trong hộp, xác nhận gọi hook, Esc đóng (A12)', () => {
    const confirmRemoveMember = vi.fn();
    const cancelRemoveMember = vi.fn();
    render(
      <MembersTab
        {...tabProps({
          confirmRemoveMember,
          cancelRemoveMember,
          memberRemoveDialog: {
            title: 'Gỡ Phạm An khỏi dự án?',
            message: 'Người này sẽ không còn truy cập được dự án.',
            error: viMessages.project.settings.members.lastEditor,
            confirmLabel: 'Gỡ',
            cancelLabel: 'Để nguyên',
            isRunning: false,
          },
        })}
      />,
    );

    const dialog = within(screen.getByRole('dialog'));

    expect(dialog.getByText('Gỡ Phạm An khỏi dự án?')).toBeInTheDocument();
    expect(dialog.getByRole('alert')).toHaveTextContent(viMessages.project.settings.members.lastEditor);

    fireEvent.click(dialog.getByRole('button', { name: 'Gỡ' }));
    expect(confirmRemoveMember).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(cancelRemoveMember).toHaveBeenCalledTimes(1);
  });

  it('rỗng thì vẫn có ô thêm người; đang tải thì khung xương', () => {
    const { unmount } = render(<MembersTab {...tabProps({ members: [], memberCountLabel: '0 thành viên' })} />);

    expect(screen.getByText('Chưa có thành viên nào')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    unmount();

    render(<MembersTab {...tabProps({ state: 'loading' })} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('tiếng Việt có dấu và dùng được bằng bàn phím', () => {
    const { container } = render(<MembersTab {...tabProps()} />);

    expectVietnamese(container);
    expectAccessible(container, { ignoreSelector: '[role="dialog"], button[tabindex="-1"]' });
  });
});

describe('thành viên trong useProjectSettings', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  async function tick(durationMs: number): Promise<void> {
    await act(async () => {
      await clock.advance(durationMs);
    });
  }

  async function mount(
    server: FakeServer,
    options: Partial<UseProjectSettingsOptions> & { readonly roles?: UseProjectSettingsOptions['roles'] } = {},
  ) {
    const { queryClient, wrapper } = createHookWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const gateway = createProjectSettingsGateway(server.client);
    const onToast = vi.fn();
    const hook = renderHook(
      () =>
        useProjectSettings({
          gateway,
          projectId: PROJECT_ID,
          roles: ['admin'],
          now: clock.epochMs,
          isOnline: () => true,
          onToast,
          ...options,
        }),
      { wrapper },
    );

    await tick(0);
    invalidate.mockClear();

    return { ...hook, onToast, invalidate };
  }

  const invalidatedKeys = (invalidate: { mock: { calls: readonly (readonly unknown[])[] } }): unknown[] =>
    invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);

  async function addEmail(hook: Awaited<ReturnType<typeof mount>>, email: string): Promise<void> {
    act(() => {
      hook.result.current.setMemberEmail(email);
    });
    await act(async () => {
      hook.result.current.addMember();
      await clock.flushMicrotasks();
    });
  }

  it('thêm thật: toast nói rõ hậu quả, vô hiệu hoá chi tiết dự án, hoàn tác gọi N4', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    await addEmail(hook, ' Newcomer@Example.com ');

    expect(server.membersAdd.mock.calls[0]?.[0]).toMatchObject({ email: 'newcomer@example.com' });
    expect(hook.onToast).toHaveBeenCalledTimes(1);

    const toast = hook.onToast.mock.calls[0]?.[0] as { message: string; onUndo?: () => void };

    expect(toast.message).toBe(
      'Đã thêm Newcomer; hoàn tác sẽ gỡ người này, thông báo mời đã gửi không thu hồi được.',
    );
    expect(invalidatedKeys(hook.invalidate)).toContainEqual(queryKeys.project.detail(PROJECT_ID));
    expect(hook.result.current.memberEmail).toBe('');

    await act(async () => {
      toast.onUndo?.();
      await clock.flushMicrotasks();
    });

    expect(server.membersRemove.mock.calls[0]?.[0]).toMatchObject({ projectId: PROJECT_ID, userId: NEWCOMER_USER.id });
  });

  it('MEMBER_USER_UNAVAILABLE: câu "chưa có tài khoản đang hoạt động", không toast', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersAdd.mockResolvedValueOnce({ ok: false, error: httpError(422, 'MEMBER_USER_UNAVAILABLE') });
    await addEmail(hook, 'ghost@example.com');

    expect(hook.result.current.memberError).toBe(viMessages.project.settings.members.unavailable);
    expect(hook.onToast).not.toHaveBeenCalled();
  });

  it('422 VALIDATION field email: "địa chỉ email chưa đúng"', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersAdd.mockResolvedValueOnce({ ok: false, error: httpError(422, 'VALIDATION', { field: 'email' }) });
    await addEmail(hook, 'x@example.com');

    expect(hook.result.current.memberError).toBe(viMessages.project.settings.members.badEmail);
  });

  it('email trống thì báo ngay, không gọi mạng', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    await addEmail(hook, '   ');

    expect(hook.result.current.memberError).toBe(viMessages.project.settings.members.emailRequired);
    expect(server.membersAdd).not.toHaveBeenCalled();
  });

  it('email khác hoa thường của thành viên có sẵn: "đã là thành viên", không gửi, không vé', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    await addEmail(hook, 'ENGINEER@example.com');

    expect(server.membersAdd).not.toHaveBeenCalled();
    expect(hook.result.current.memberError).toBe(viMessages.project.settings.members.alreadyMember);
    expect(hook.onToast).not.toHaveBeenCalled();
  });

  it('N3 trả người có trong #24 vừa đọc: không vé, không vô hiệu hoá', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersAdd.mockResolvedValueOnce({ ok: true, data: ADMIN_USER });
    await addEmail(hook, 'someone@example.com');

    expect(server.membersAdd).toHaveBeenCalledTimes(1);
    expect(hook.onToast).not.toHaveBeenCalled();
    expect(hook.result.current.memberError).toBe(viMessages.project.settings.members.alreadyMember);
    expect(invalidatedKeys(hook.invalidate)).toEqual([]);
  });

  it('429 retryAfterSeconds 7: câu không chữ số, nút khoá đúng 60 giây', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersAdd.mockResolvedValueOnce({
      ok: false,
      error: httpError(429, 'RATE_LIMITED', {}, { retryAfterSeconds: 7 }),
    });
    await addEmail(hook, 'a@example.com');

    expect(hook.result.current.memberError).toBe(viMessages.project.settings.members.rateLimited);
    expect(hook.result.current.memberError).not.toMatch(/\d/u);
    expect(hook.result.current.isAddMemberLocked).toBe(true);

    await tick(59_000);
    expect(hook.result.current.isAddMemberLocked).toBe(true);

    // Bấm trong lúc khoá không gửi gì.
    await addEmail(hook, 'a@example.com');
    expect(server.membersAdd).toHaveBeenCalledTimes(1);

    await tick(1_000);
    expect(hook.result.current.isAddMemberLocked).toBe(false);
  });

  it('429 với Retry-After lớn hơn 60 thì khoá theo số lớn hơn', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersAdd.mockResolvedValueOnce({
      ok: false,
      error: httpError(429, 'RATE_LIMITED', {}, { retryAfterSeconds: 90 }),
    });
    await addEmail(hook, 'a@example.com');
    await tick(89_000);

    expect(hook.result.current.isAddMemberLocked).toBe(true);

    await tick(1_000);

    expect(hook.result.current.isAddMemberLocked).toBe(false);
  });

  it('lỗi mạng thì câu chung của màn, và gửi lại cùng email giữ khoá', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersAdd.mockResolvedValueOnce({ ok: false, error: networkError() });
    await addEmail(hook, 'a@example.com');

    expect(hook.result.current.memberError).not.toBeNull();

    await addEmail(hook, 'a@example.com');

    expect(server.membersAdd.mock.calls[1]?.[0].idempotencyKey).toBe(server.membersAdd.mock.calls[0]?.[0].idempotencyKey);
  });

  it('gỡ qua hộp thoại A9: không toast hoàn tác, vô hiệu hoá chi tiết dự án', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    act(() => {
      hook.result.current.requestRemoveMember(ENGINEER_USER.id);
    });

    expect(hook.result.current.memberRemoveDialog).toMatchObject({
      title: 'Gỡ Engineer khỏi dự án?',
      error: null,
    });
    expect(server.membersRemove).not.toHaveBeenCalled();

    await act(async () => {
      hook.result.current.confirmRemoveMember();
      await clock.flushMicrotasks();
    });

    expect(server.membersRemove.mock.calls[0]?.[0]).toMatchObject({ userId: ENGINEER_USER.id });
    expect(hook.result.current.memberRemoveDialog).toBeNull();
    expect(invalidatedKeys(hook.invalidate)).toContainEqual(queryKeys.project.detail(PROJECT_ID));
    expect(hook.onToast).toHaveBeenCalledTimes(1);
    expect(hook.onToast.mock.calls[0]?.[0]).not.toHaveProperty('onUndo');
  });

  it('huỷ hộp thoại thì không gỡ', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    act(() => {
      hook.result.current.requestRemoveMember(ENGINEER_USER.id);
    });
    act(() => {
      hook.result.current.cancelRemoveMember();
    });

    expect(hook.result.current.memberRemoveDialog).toBeNull();
    expect(server.membersRemove).not.toHaveBeenCalled();
  });

  it('gỡ chính mình: hộp thoại nói mất quyền xem, xong thì gọi callback về dashboard', async () => {
    const server = await createFakeServer();
    const onSelfRemoved = vi.fn();
    const hook = await mount(server, { currentUserId: ADMIN_USER.id, onSelfRemoved });

    act(() => {
      hook.result.current.requestRemoveMember(ADMIN_USER.id);
    });

    expect(hook.result.current.memberRemoveDialog?.message).toContain('mất quyền xem dự án này');

    await act(async () => {
      hook.result.current.confirmRemoveMember();
      await clock.flushMicrotasks();
    });

    expect(onSelfRemoved).toHaveBeenCalledTimes(1);
    expect(invalidatedKeys(hook.invalidate)).toEqual([]);
  });

  it('MEMBER_LAST_EDITOR: lỗi hiện trong hộp thoại, hộp giữ nguyên, không điều hướng', async () => {
    const server = await createFakeServer();
    const onSelfRemoved = vi.fn();
    const hook = await mount(server, { currentUserId: ADMIN_USER.id, onSelfRemoved });

    server.membersRemove.mockResolvedValueOnce({ ok: false, error: httpError(422, 'MEMBER_LAST_EDITOR') });
    act(() => {
      hook.result.current.requestRemoveMember(ADMIN_USER.id);
    });
    await act(async () => {
      hook.result.current.confirmRemoveMember();
      await clock.flushMicrotasks();
    });

    expect(hook.result.current.memberRemoveDialog?.error).toBe(viMessages.project.settings.members.lastEditor);
    expect(onSelfRemoved).not.toHaveBeenCalled();
  });

  it('404 member: coi như đã gỡ', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    server.membersRemove.mockResolvedValueOnce({
      ok: false,
      error: httpError(404, 'NOT_FOUND', { resource: 'member' }),
    });
    act(() => {
      hook.result.current.requestRemoveMember(ENGINEER_USER.id);
    });
    await act(async () => {
      hook.result.current.confirmRemoveMember();
      await clock.flushMicrotasks();
    });

    expect(hook.result.current.memberRemoveDialog).toBeNull();
    expect(invalidatedKeys(hook.invalidate)).toContainEqual(queryKeys.project.detail(PROJECT_ID));
  });

  it('vai người xem: không thêm, không gỡ được dù gọi thẳng hành động', async () => {
    const server = await createFakeServer();
    const hook = await mount(server, { roles: ['viewer'] });

    await addEmail(hook, 'newcomer@example.com');
    act(() => {
      hook.result.current.requestRemoveMember(ENGINEER_USER.id);
    });

    expect(hook.result.current.canEdit).toBe(false);
    expect(server.membersAdd).not.toHaveBeenCalled();
    expect(hook.result.current.memberRemoveDialog).toBeNull();
  });

  it('nháp gõ dở trong thẻ chung vẫn còn sau khi thêm thành viên làm tải lại dữ liệu', async () => {
    const server = await createFakeServer();
    const hook = await mount(server);

    act(() => {
      hook.result.current.setName('Đang gõ dở');
    });
    await addEmail(hook, 'newcomer@example.com');
    await tick(0);

    expect(hook.result.current.name).toBe('Đang gõ dở');
  });
});
