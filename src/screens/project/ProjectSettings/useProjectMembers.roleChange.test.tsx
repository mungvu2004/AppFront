import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/api/client';
import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';
import { queryKeys } from '@/lib/query/queryKeys';

import { createProjectSettingsGateway } from './projectSettingsGateway';
import { roleChangeConsequence } from './useProjectMembers';
import {
  ADMIN_USER,
  ENGINEER_USER,
  PROJECT_ID,
  createFakeServer,
  createHookWrapper,
  httpError,
  installMatchMedia,
  networkError,
} from './settingsTestKit';
import { useProjectSettings, type UseProjectSettingsOptions } from './useProjectSettings';

beforeAll(() => {
  installMatchMedia();
});

afterEach(() => {
  cleanup();
});

/** N4-03: đổi vai toàn hệ thống từ thẻ Thành viên. */
describe('đổi vai thành viên (N4-03)', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
  });

  async function flush(): Promise<void> {
    await act(async () => {
      await clock.advance(0);
    });
  }

  async function mount(
    users: Partial<ApiClient['users']> = {},
    options: Partial<UseProjectSettingsOptions> = {},
  ) {
    const server = await createFakeServer();
    const changeRole = vi.fn<ApiClient['users']['changeRole']>(
      users.changeRole ??
        (async ({ body }) => {
          // Máy chủ giả nhớ vai mới: lượt tải lại chi tiết dự án (luật `changeUserRole`) phải trả vai mới.
          const members = server.project.members as { id: string; role: string }[];
          const index = members.findIndex((member) => member.id === body.userId);
          members[index] = { ...members[index]!, role: body.role } as never;
          return { ok: true, data: {} as never };
        }),
    );
    const memberships = vi.fn<ApiClient['users']['memberships']>(
      users.memberships ??
        (async () => ({
          ok: true,
          data: [
            { projectId: 'prj_a', projectName: 'Nhà A', role: 'engineer' },
            { projectId: 'prj_b', projectName: 'Nhà B', role: 'engineer' },
          ],
        })),
    );
    const client: ApiClient = { ...server.client, users: { ...server.client.users, changeRole, memberships } };
    const { queryClient, wrapper } = createHookWrapper();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const onToast = vi.fn();
    const hook = renderHook(
      () =>
        useProjectSettings({
          gateway: createProjectSettingsGateway(client),
          projectId: PROJECT_ID,
          roles: ['admin'],
          currentUserId: ADMIN_USER.id,
          now: clock.epochMs,
          isOnline: () => true,
          onToast,
          ...options,
        }),
      { wrapper },
    );

    await flush();
    invalidate.mockClear();

    return { ...hook, changeRole, memberships, onToast, invalidate };
  }

  const engineerRow = (hook: Awaited<ReturnType<typeof mount>>) =>
    hook.result.current.members.find((member) => member.id === ENGINEER_USER.id);

  async function request(hook: Awaited<ReturnType<typeof mount>>, role: 'admin' | 'engineer' | 'viewer') {
    act(() => {
      hook.result.current.requestRoleChange(ENGINEER_USER.id, role);
    });
    await flush();
  }

  it('quản trị viên đổi được vai người khác, không đổi được vai của mình; kỹ sư thì không', async () => {
    const admin = await mount();

    expect(engineerRow(admin)?.canChangeRole).toBe(true);
    expect(engineerRow(admin)?.roleOptions.map((option) => option.label)).toEqual(['Quản trị', 'Kỹ sư', 'Người xem']);
    expect(admin.result.current.members.find((member) => member.id === ADMIN_USER.id)?.canChangeRole).toBe(false);
    admin.unmount();

    const engineer = await mount({}, { roles: ['engineer'], currentUserId: ENGINEER_USER.id });

    expect(engineer.result.current.members.every((member) => !member.canChangeRole)).toBe(true);
    act(() => {
      engineer.result.current.requestRoleChange(ADMIN_USER.id, 'viewer');
    });
    expect(engineer.result.current.roleChangeDialog).toEqual({ state: 'closed' });
    expect(engineer.memberships).not.toHaveBeenCalled();
  });

  it('chọn vai thì đọc dự án của người đó rồi mở hộp; xác nhận gửi đúng thân, cập nhật danh sách và báo toast', async () => {
    const hook = await mount();

    act(() => {
      hook.result.current.requestRoleChange(ENGINEER_USER.id, 'viewer');
    });
    expect(hook.result.current.roleChangeDialog).toEqual({ state: 'loading' });
    await flush();

    expect(hook.memberships).toHaveBeenCalledWith({ userId: ENGINEER_USER.id });
    expect(hook.result.current.roleChangeDialog).toEqual({
      state: 'open',
      memberName: 'Engineer',
      fromLabel: 'Kỹ sư',
      toLabel: 'Người xem',
      projectNames: ['Nhà A', 'Nhà B'],
      consequence: 'Engineer sẽ chỉ xem được, không sửa được bản vẽ, tầng hay cài đặt ở 2 dự án.',
      error: null,
      isSubmitting: false,
    });

    act(() => {
      hook.result.current.confirmRoleChange();
    });
    await flush();

    expect(hook.changeRole).toHaveBeenCalledWith({ body: { role: 'viewer', userId: ENGINEER_USER.id } });
    expect(hook.result.current.roleChangeDialog).toEqual({ state: 'closed' });
    expect(engineerRow(hook)?.roleLabel).toBe('Người xem');
    expect(hook.onToast).toHaveBeenCalledWith({ message: 'Đã đổi vai Engineer thành Người xem (mọi dự án).' });
    expect(hook.invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey)).toContainEqual(
      queryKeys.user.memberships(ENGINEER_USER.id),
    );
  });

  it('MEMBER_LAST_EDITOR: hộp vẫn mở với câu dễ hiểu, vai không đổi', async () => {
    const hook = await mount({ changeRole: async () => ({ ok: false, error: httpError(422, 'MEMBER_LAST_EDITOR') }) });

    await request(hook, 'viewer');
    act(() => {
      hook.result.current.confirmRoleChange();
    });
    await flush();

    const dialog = hook.result.current.roleChangeDialog;

    expect(dialog.state).toBe('open');
    expect(dialog.state === 'open' ? dialog.error : null).toBe(
      'Chưa hạ được vai: người này là người sửa cuối cùng của ít nhất một dự án. Hãy cho thêm một người có quyền sửa vào dự án đó trước.',
    );
    expect(engineerRow(hook)?.roleLabel).toBe('Kỹ sư');
    expect(hook.onToast).not.toHaveBeenCalled();
  });

  it('consequence nói hậu quả theo vai mới; không có danh sách dự án thì nói chung', async () => {
    const hook = await mount();

    await request(hook, 'admin');
    expect(hook.result.current.roleChangeDialog).toMatchObject({
      consequence: 'Engineer sẽ quản trị được toàn hệ thống: vào khu Quản trị, mời và đổi vai người dùng.',
    });
    hook.unmount();

    const noList = await mount({ memberships: async () => ({ ok: false, error: networkError() }) });

    await request(noList, 'viewer');
    expect(noList.result.current.roleChangeDialog).toMatchObject({
      consequence: 'Engineer sẽ chỉ xem được, không sửa được bản vẽ, tầng hay cài đặt ở mọi dự án của người này.',
    });
  });

  it('lỗi khác dùng câu chung theo loại lỗi', async () => {
    const hook = await mount({ changeRole: async () => ({ ok: false, error: networkError() }) });

    await request(hook, 'admin');
    act(() => {
      hook.result.current.confirmRoleChange();
    });
    await flush();

    const dialog = hook.result.current.roleChangeDialog;

    expect(dialog.state === 'open' ? dialog.error : null).toEqual(expect.any(String));
    expect(dialog.state === 'open' ? dialog.error : '').not.toContain('MEMBER_LAST_EDITOR');
    expect(engineerRow(hook)?.roleLabel).toBe('Kỹ sư');
  });

  it('không đọc được dự án thì vẫn mở hộp với danh sách rỗng', async () => {
    const hook = await mount({ memberships: async () => ({ ok: false, error: networkError() }) });

    await request(hook, 'viewer');

    expect(hook.result.current.roleChangeDialog).toMatchObject({ state: 'open', projectNames: [] });
  });

  it('Huỷ (cả khi đang tải) thì đóng hộp, không gọi máy chủ đổi vai; chọn lại đúng vai cũ thì không mở', async () => {
    const hook = await mount();

    act(() => {
      hook.result.current.requestRoleChange(ENGINEER_USER.id, 'viewer');
      hook.result.current.cancelRoleChange();
    });
    await flush();
    expect(hook.result.current.roleChangeDialog).toEqual({ state: 'closed' });

    await request(hook, 'viewer');
    act(() => {
      hook.result.current.cancelRoleChange();
    });
    expect(hook.result.current.roleChangeDialog).toEqual({ state: 'closed' });

    await request(hook, 'engineer');
    expect(hook.result.current.roleChangeDialog).toEqual({ state: 'closed' });
    expect(hook.changeRole).not.toHaveBeenCalled();
  });
});

describe('roleChangeConsequence', () => {
  const base = { name: 'An', projectNames: ['A', 'B', 'C'] } as const;

  it('đủ bốn hướng đổi vai', () => {
    expect(roleChangeConsequence({ ...base, from: 'admin', to: 'viewer' })).toBe(
      'An sẽ chỉ xem được, không sửa được bản vẽ, tầng hay cài đặt ở 3 dự án và mất quyền vào khu Quản trị.',
    );
    expect(roleChangeConsequence({ ...base, from: 'admin', to: 'engineer' })).toBe(
      'An sẽ mất quyền vào khu Quản trị, vẫn sửa được bản vẽ, tầng và cài đặt ở 3 dự án.',
    );
    expect(roleChangeConsequence({ ...base, from: 'viewer', to: 'engineer' })).toBe(
      'An sẽ sửa được bản vẽ, tầng và cài đặt ở 3 dự án.',
    );
    expect(roleChangeConsequence({ ...base, from: 'viewer', to: 'admin' })).toContain('quản trị được toàn hệ thống');
  });
});
