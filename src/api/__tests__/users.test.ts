import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';

import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  ADMIN_USER_ROLES,
  ADMIN_USER_STATUSES,
  AdminUserListSchema,
  AdminUserSchema,
  InviteUsersSchema,
  RemoveUserSchema,
  RoleChangeSchema,
  UserActivitySchema,
  UserMembershipSchema,
  type AdminUserWire,
} from '../schemas/users';
import {
  createMockApiClient,
  createMockAuthTransport,
  MOCK_ADMIN_USERS,
  MOCK_ADMIN_USERS_SOLO,
  MOCK_USERS_ERROR_USER_ID,
  MOCK_USERS_INVITE_EXPIRY,
  MOCK_USERS_REFERENCE_TIME,
  resetMockAuthSession,
} from '../__mocks__/client';

/* -------------------------------------------------------------------------- */
/* Bộ dựng dùng chung.                                                         */
/* -------------------------------------------------------------------------- */

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const httpError: HttpError = {
  kind: 'http',
  raw: undefined,
  requestId: 'req-users-1',
  retryable: false,
  status: 500,
};

interface HttpCall {
  body: unknown;
  method: string;
  path: string;
}

const createHttpMock = (
  responses: Record<string, unknown> = {},
): { calls: HttpCall[]; http: HttpClient } => {
  const calls: HttpCall[] = [];

  const record =
    (method: string) =>
    (path: string, options?: { body?: unknown }): Result<never, HttpError> => {
      calls.push({ body: options?.body, method, path });

      return ok(responses[`${method} ${path}`] as never);
    };

  const http = {
    delete: vi.fn(record('DELETE')),
    events: { emit: () => undefined, on: () => () => undefined },
    get: vi.fn(record('GET')),
    getRecentRequests: () => [],
    patch: vi.fn(record('PATCH')),
    post: vi.fn(record('POST')),
    put: vi.fn(record('PUT')),
  } as unknown as HttpClient;

  return { calls, http };
};

const createFailingHttpMock = (): HttpClient => {
  const fail = (): Result<never, HttpError> => ({ ok: false, error: httpError });

  return {
    delete: vi.fn(fail),
    events: { emit: () => undefined, on: () => () => undefined },
    get: vi.fn(fail),
    getRecentRequests: () => [],
    patch: vi.fn(fail),
    post: vi.fn(fail),
    put: vi.fn(fail),
  } as unknown as HttpClient;
};

const activeUserWire: AdminUserWire = {
  avatarUrl: 'https://example.com/avatars/user-2.png',
  email: 'engineer@example.com',
  id: 'user-2',
  lastActiveAt: '2026-09-08T05:30:00.000Z',
  name: 'Nguyễn Bình',
  projectCount: 4,
  role: 'engineer',
  status: 'active',
};

const pendingUserWire: AdminUserWire = {
  email: 'vu.hanh@example.com',
  id: 'user-6',
  inviteExpiresAt: '2026-09-08T08:00:00.000Z',
  invitedAt: '2026-09-01T09:00:00.000Z',
  lastActiveAt: null,
  name: 'Vũ Thị Hạnh',
  projectCount: 0,
  role: 'viewer',
  status: 'pending',
};

/* -------------------------------------------------------------------------- */
/* T-04 — schema.                                                              */
/* -------------------------------------------------------------------------- */

describe('AdminUserSchema', () => {
  it('decodes an active member and keeps every field', () => {
    const parsed = AdminUserSchema.parse(activeUserWire);

    expect(parsed).toEqual({
      avatarUrl: 'https://example.com/avatars/user-2.png',
      email: 'engineer@example.com',
      id: 'user-2',
      lastActiveAt: '2026-09-08T05:30:00.000Z',
      name: 'Nguyễn Bình',
      projectCount: 4,
      role: 'engineer',
      status: 'active',
    });
  });

  it('keeps both invite timestamps on a pending member', () => {
    const parsed = AdminUserSchema.parse(pendingUserWire);

    expect(parsed.status).toBe('pending');
    expect(parsed.invitedAt).toBe('2026-09-01T09:00:00.000Z');
    expect(parsed.inviteExpiresAt).toBe('2026-09-08T08:00:00.000Z');
  });

  it('drops the two invite timestamps rather than filling them in when they are absent', () => {
    const parsed = AdminUserSchema.parse(activeUserWire);

    expect('invitedAt' in parsed).toBe(false);
    expect('inviteExpiresAt' in parsed).toBe(false);
  });

  it('keeps a null lastActiveAt, because "chưa hoạt động lần nào" is an answer', () => {
    const parsed = AdminUserSchema.parse(pendingUserWire);

    expect(parsed.lastActiveAt).toBeNull();
  });

  it('rejects an absent lastActiveAt — null is the empty value, not a missing key', () => {
    const withoutLastActive: Record<string, unknown> = { ...activeUserWire };
    delete withoutLastActive.lastActiveAt;

    expect(AdminUserSchema.safeParse(withoutLastActive).success).toBe(false);
  });

  it('rejects a fourth role', () => {
    expect(AdminUserSchema.safeParse({ ...activeUserWire, role: 'architect' }).success).toBe(false);
  });

  it('rejects a status outside the three', () => {
    expect(AdminUserSchema.safeParse({ ...activeUserWire, status: 'archived' }).success).toBe(false);
  });

  it('rejects a negative or fractional project count', () => {
    expect(AdminUserSchema.safeParse({ ...activeUserWire, projectCount: -1 }).success).toBe(false);
    expect(AdminUserSchema.safeParse({ ...activeUserWire, projectCount: 1.5 }).success).toBe(false);
  });

  it('rejects a timestamp that is not ISO 8601 with an offset', () => {
    expect(AdminUserSchema.safeParse({ ...activeUserWire, lastActiveAt: '08/09/2026' }).success).toBe(false);
  });

  it('rejects an address that is not an address', () => {
    expect(AdminUserSchema.safeParse({ ...activeUserWire, email: 'engineer' }).success).toBe(false);
  });

  it('is strict: an unmodelled field stops at this layer', () => {
    expect(AdminUserSchema.safeParse({ ...activeUserWire, department: 'kết cấu' }).success).toBe(false);
  });

  it('lists exactly the three roles the domain owns and the three account statuses', () => {
    expect([...ADMIN_USER_ROLES]).toEqual(['admin', 'engineer', 'viewer']);
    expect([...ADMIN_USER_STATUSES]).toEqual(['active', 'pending', 'disabled']);
  });
});

describe('AdminUserListSchema', () => {
  it('decodes users plus a total', () => {
    const parsed = AdminUserListSchema.parse({ total: 137, users: [activeUserWire] });

    expect(parsed.total).toBe(137);
    expect(parsed.users).toHaveLength(1);
    expect(parsed.users[0]?.name).toBe('Nguyễn Bình');
  });

  it('accepts an empty page', () => {
    expect(AdminUserListSchema.parse({ total: 0, users: [] })).toEqual({ total: 0, users: [] });
  });

  it('rejects a negative total', () => {
    expect(AdminUserListSchema.safeParse({ total: -1, users: [] }).success).toBe(false);
  });

  it('rejects a page holding a broken member', () => {
    expect(
      AdminUserListSchema.safeParse({ total: 1, users: [{ ...activeUserWire, role: 'qc' }] }).success,
    ).toBe(false);
  });
});

describe('UserMembershipSchema', () => {
  it('decodes a project and the role held inside it', () => {
    expect(
      UserMembershipSchema.parse({ projectId: 'project-1', projectName: 'Chung cư Sông Hàn', role: 'viewer' }),
    ).toEqual({ projectId: 'project-1', projectName: 'Chung cư Sông Hàn', role: 'viewer' });
  });

  it('rejects an empty project name and an unknown role', () => {
    expect(
      UserMembershipSchema.safeParse({ projectId: 'project-1', projectName: '', role: 'viewer' }).success,
    ).toBe(false);
    expect(
      UserMembershipSchema.safeParse({ projectId: 'project-1', projectName: 'Nhà A', role: 'owner' }).success,
    ).toBe(false);
  });
});

describe('UserActivitySchema', () => {
  const activityWire = {
    at: '2026-09-08T05:28:00.000Z',
    id: 'activity-3',
    kind: 'wall.edit',
    objectCode: 'A-3',
    objectLabel: 'sửa tường trục a-3',
  };

  it('keeps the object code apart from the object label', () => {
    const parsed = UserActivitySchema.parse(activityWire);

    expect(parsed.objectCode).toBe('A-3');
    expect(parsed.objectLabel).toBe('sửa tường trục a-3');
  });

  it('rejects an empty code, an empty label and a broken timestamp', () => {
    expect(UserActivitySchema.safeParse({ ...activityWire, objectCode: '' }).success).toBe(false);
    expect(UserActivitySchema.safeParse({ ...activityWire, objectLabel: '' }).success).toBe(false);
    expect(UserActivitySchema.safeParse({ ...activityWire, at: 'hôm qua' }).success).toBe(false);
  });
});

describe('InviteUsersSchema', () => {
  it('accepts one or many addresses at one role', () => {
    expect(
      InviteUsersSchema.parse({ emails: ['a@example.com', 'b@example.com'], role: 'engineer' }),
    ).toEqual({ emails: ['a@example.com', 'b@example.com'], role: 'engineer' });
  });

  it('rejects an invitation with no address — that is an unfilled form, not a request', () => {
    expect(InviteUsersSchema.safeParse({ emails: [], role: 'viewer' }).success).toBe(false);
  });

  it('rejects the whole invitation when one address is broken', () => {
    expect(
      InviteUsersSchema.safeParse({ emails: ['a@example.com', 'khong-phai-dia-chi'], role: 'viewer' }).success,
    ).toBe(false);
  });

  it('rejects a role outside the three', () => {
    expect(InviteUsersSchema.safeParse({ emails: ['a@example.com'], role: 'qc' }).success).toBe(false);
  });
});

describe('RoleChangeSchema and RemoveUserSchema', () => {
  it('accepts a role change for one user', () => {
    expect(RoleChangeSchema.parse({ role: 'admin', userId: 'user-3' })).toEqual({
      role: 'admin',
      userId: 'user-3',
    });
  });

  it('rejects a role change with no user', () => {
    expect(RoleChangeSchema.safeParse({ role: 'admin', userId: '' }).success).toBe(false);
  });

  it('demands a typed-back address before a removal is even a request (A9)', () => {
    expect(RemoveUserSchema.parse({ confirmEmail: 'viewer@example.com', userId: 'user-3' })).toEqual({
      confirmEmail: 'viewer@example.com',
      userId: 'user-3',
    });
    expect(RemoveUserSchema.safeParse({ confirmEmail: '', userId: 'user-3' }).success).toBe(false);
    expect(RemoveUserSchema.safeParse({ userId: 'user-3' }).success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* T-05 — đường dẫn.                                                           */
/* -------------------------------------------------------------------------- */

describe('ENDPOINTS.users', () => {
  it('hangs every per-user path off the user, not off a project', () => {
    expect(ENDPOINTS.users.list).toBe('/users');
    expect(ENDPOINTS.users.activity('user-2')).toBe('/users/user-2/activity');
    expect(ENDPOINTS.users.changeRole('user-2')).toBe('/users/user-2/role');
    expect(ENDPOINTS.users.disable('user-2')).toBe('/users/user-2/disable');
    expect(ENDPOINTS.users.enable('user-2')).toBe('/users/user-2/enable');
    expect(ENDPOINTS.users.memberships('user-2')).toBe('/users/user-2/memberships');
    expect(ENDPOINTS.users.remove('user-2')).toBe('/users/user-2');
  });

  it('addresses an invitation as its own resource, because a pending invite is not yet a user', () => {
    expect(ENDPOINTS.users.invite).toBe('/users/invitations');
    expect(ENDPOINTS.users.resendInvite('invite-9')).toBe('/users/invitations/invite-9/resend');
  });
});

/* -------------------------------------------------------------------------- */
/* UsersApi — chín phương thức.                                                */
/* -------------------------------------------------------------------------- */

describe('UsersApi', () => {
  it('reads the list through AdminUserListSchema, total included', async () => {
    const { calls, http } = createHttpMock({
      'GET /users': { total: 1, users: [activeUserWire] },
    });

    const result = await createApiClient(http).users.list();

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.total).toBe(1);
    expect(result.ok && result.data.users[0]?.name).toBe('Nguyễn Bình');
    expect(calls).toEqual([{ body: undefined, method: 'GET', path: '/users' }]);
  });

  it('reports a broken list payload as a failure rather than an empty table', async () => {
    const { http } = createHttpMock({ 'GET /users': { total: 1, users: [{ id: 'user-2' }] } });

    expect((await createApiClient(http).users.list()).ok).toBe(false);
  });

  it('reads memberships and activity for one user', async () => {
    const { calls, http } = createHttpMock({
      'GET /users/user-2/activity': [
        {
          at: '2026-09-08T05:28:00.000Z',
          id: 'activity-3',
          kind: 'wall.edit',
          objectCode: 'A-3',
          objectLabel: 'sửa tường trục a-3',
        },
      ],
      'GET /users/user-2/memberships': [
        { projectId: 'project-1', projectName: 'Chung cư Sông Hàn', role: 'engineer' },
      ],
    });
    const client = createApiClient(http);

    const memberships = await client.users.memberships({ userId: 'user-2' });
    const activity = await client.users.activity({ userId: 'user-2' });

    expect(memberships.ok && memberships.data[0]?.projectName).toBe('Chung cư Sông Hàn');
    expect(activity.ok && activity.data[0]?.objectCode).toBe('A-3');
    expect(calls.map((call) => call.path)).toEqual([
      '/users/user-2/memberships',
      '/users/user-2/activity',
    ]);
  });

  it('posts an invitation to the invitations resource and decodes the created members', async () => {
    const { calls, http } = createHttpMock({ 'POST /users/invitations': [pendingUserWire] });

    const result = await createApiClient(http).users.invite({
      body: { emails: ['vu.hanh@example.com'], role: 'viewer' },
    });

    expect(result.ok && result.data[0]?.status).toBe('pending');
    expect(calls[0]).toEqual({
      body: { emails: ['vu.hanh@example.com'], role: 'viewer' },
      method: 'POST',
      path: '/users/invitations',
    });
  });

  it('patches a role change onto the user named in the body', async () => {
    const { calls, http } = createHttpMock({
      'PATCH /users/user-2/role': { ...activeUserWire, role: 'admin' },
    });

    const result = await createApiClient(http).users.changeRole({
      body: { role: 'admin', userId: 'user-2' },
    });

    expect(result.ok && result.data.role).toBe('admin');
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.path).toBe('/users/user-2/role');
  });

  it('keeps enable and disable as two paths, each answering with the changed record', async () => {
    const { calls, http } = createHttpMock({
      'POST /users/user-2/disable': { ...activeUserWire, status: 'disabled' },
      'POST /users/user-2/enable': { ...activeUserWire, status: 'active' },
    });
    const client = createApiClient(http);

    const disabled = await client.users.disable({ userId: 'user-2' });
    const enabled = await client.users.enable({ userId: 'user-2' });

    expect(disabled.ok && disabled.data.status).toBe('disabled');
    expect(enabled.ok && enabled.data.status).toBe('active');
    expect(calls.map((call) => call.path)).toEqual(['/users/user-2/disable', '/users/user-2/enable']);
  });

  it('sends the retyped address in the body of the removal, never in the path (A9)', async () => {
    const { calls, http } = createHttpMock({ 'DELETE /users/user-2': activeUserWire });

    const result = await createApiClient(http).users.remove({
      body: { confirmEmail: 'engineer@example.com', userId: 'user-2' },
    });

    expect(result.ok && result.data.id).toBe('user-2');
    expect(calls[0]).toEqual({
      body: { confirmEmail: 'engineer@example.com', userId: 'user-2' },
      method: 'DELETE',
      path: '/users/user-2',
    });
  });

  it('resends an invitation by invite id', async () => {
    const { calls, http } = createHttpMock({
      'POST /users/invitations/invite-9/resend': pendingUserWire,
    });

    const result = await createApiClient(http).users.resendInvite({ inviteId: 'invite-9' });

    expect(result.ok && result.data.status).toBe('pending');
    expect(calls[0]?.path).toBe('/users/invitations/invite-9/resend');
  });

  it('passes a transport failure through untouched on all nine methods', async () => {
    const client = createApiClient(createFailingHttpMock());

    const results = [
      await client.users.activity({ userId: 'user-2' }),
      await client.users.changeRole({ body: { role: 'admin', userId: 'user-2' } }),
      await client.users.disable({ userId: 'user-2' }),
      await client.users.enable({ userId: 'user-2' }),
      await client.users.invite({ body: { emails: ['a@example.com'], role: 'viewer' } }),
      await client.users.list(),
      await client.users.memberships({ userId: 'user-2' }),
      await client.users.remove({ body: { confirmEmail: 'a@example.com', userId: 'user-2' } }),
      await client.users.resendInvite({ inviteId: 'invite-9' }),
    ];

    expect(results).toHaveLength(9);
    results.forEach((result) => {
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe(httpError);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — bảy trạng thái của A11.                                            */
/* -------------------------------------------------------------------------- */

/** Đăng nhập vào bộ mẫu bằng một địa chỉ, để vai của phiên là vai của người ấy. */
const signInAs = async (email: string): Promise<void> => {
  const client = createMockApiClient();

  await client.auth.signIn({ body: { email, password: 'mat-khau-du-dai', rememberMe: false } });
  await createMockAuthTransport()('/auth/refresh');
};

describe('bộ mẫu users — bảy trạng thái', () => {
  it('trạng thái Xong: đủ ba vai, một người bị vô hiệu, mốc hoạt động rải rác', async () => {
    resetMockAuthSession();
    await signInAs('admin@example.com');

    const result = await createMockApiClient().users.list();

    expect(result.ok).toBe(true);

    const users = result.ok ? result.data.users : [];

    expect(result.ok && result.data.total).toBe(users.length);
    expect(new Set(users.map((user) => user.role))).toEqual(new Set(['admin', 'engineer', 'viewer']));
    expect(users.filter((user) => user.status === 'disabled')).toHaveLength(1);
    expect(new Set(users.map((user) => user.lastActiveAt)).size).toBeGreaterThan(3);
  });

  it('trạng thái Một phần: đúng ba lời mời chờ, ít nhất một cái đã quá hạn', () => {
    const pending = MOCK_ADMIN_USERS.filter((user) => user.status === 'pending');
    const reference = Date.parse(MOCK_USERS_REFERENCE_TIME);

    expect(pending).toHaveLength(3);
    pending.forEach((user) => {
      expect(user.invitedAt).toBeDefined();
      expect(user.inviteExpiresAt).toBeDefined();
      expect(user.lastActiveAt).toBeNull();
    });
    expect(
      pending.filter((user) => Date.parse(user.inviteExpiresAt ?? '') < reference).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('trạng thái Rỗng: đúng một người, chính người đang đăng nhập', () => {
    expect(MOCK_ADMIN_USERS_SOLO).toHaveLength(1);
    expect(MOCK_ADMIN_USERS_SOLO[0]?.role).toBe('admin');
  });

  it('trạng thái Lỗi: hai lượt đọc theo người trả lỗi cho đúng một id', async () => {
    const client = createMockApiClient();

    const memberships = await client.users.memberships({ userId: MOCK_USERS_ERROR_USER_ID });
    const activity = await client.users.activity({ userId: MOCK_USERS_ERROR_USER_ID });
    const healthy = await client.users.memberships({ userId: 'user-2' });

    expect(memberships.ok).toBe(false);
    expect(activity.ok).toBe(false);
    expect(healthy.ok).toBe(true);
  });

  it('trạng thái Không có quyền: phiên vai viewer bị từ chối đọc danh sách', async () => {
    resetMockAuthSession();
    await signInAs('viewer@example.com');

    const result = await createMockApiClient().users.list();

    expect(result.ok).toBe(false);
    expect(!result.ok && 'status' in result.error && result.error.status).toBe(403);
  });

  it('mọi bản ghi của bộ mẫu đi qua được AdminUserSchema', () => {
    MOCK_ADMIN_USERS.forEach((user) => {
      expect(AdminUserSchema.safeParse(user).success).toBe(true);
    });
  });

  it('tên người và tên dự án của bộ mẫu là tiếng Việt có dấu', () => {
    const diacritics = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

    expect(MOCK_ADMIN_USERS.some((user) => diacritics.test(user.name))).toBe(true);
    expect(MOCK_ADMIN_USERS.every((user) => !diacritics.test(user.email))).toBe(true);
  });
});

describe('bộ mẫu users — bảy lượt ghi', () => {
  it('mời xong thì người mới có mặt trong danh sách, ở trạng thái chờ và còn hạn', async () => {
    resetMockAuthSession();
    await signInAs('admin@example.com');

    const client = createMockApiClient();
    const invited = await client.users.invite({
      body: { emails: ['nguoi.moi@example.com'], role: 'engineer' },
    });

    expect(invited.ok && invited.data).toHaveLength(1);
    expect(invited.ok && invited.data[0]?.status).toBe('pending');
    expect(invited.ok && invited.data[0]?.inviteExpiresAt).toBe(MOCK_USERS_INVITE_EXPIRY);

    const listed = await client.users.list();

    expect(listed.ok && listed.data.users.some((user) => user.email === 'nguoi.moi@example.com')).toBe(true);
  });

  it('đổi vai, vô hiệu rồi bật lại đều trả về bản ghi vừa đổi', async () => {
    const client = createMockApiClient();

    const promoted = await client.users.changeRole({ body: { role: 'admin', userId: 'user-3' } });
    const disabled = await client.users.disable({ userId: 'user-3' });
    const enabled = await client.users.enable({ userId: 'user-3' });

    expect(promoted.ok && promoted.data.role).toBe('admin');
    expect(disabled.ok && disabled.data.status).toBe('disabled');
    expect(enabled.ok && enabled.data.status).toBe('active');
    expect(enabled.ok && enabled.data.role).toBe('admin');
  });

  it('xoá xong thì người ấy rời danh sách, và bản ghi vừa xoá đi kèm cho toast', async () => {
    resetMockAuthSession();
    await signInAs('admin@example.com');

    const client = createMockApiClient();
    const removed = await client.users.remove({
      body: { confirmEmail: 'viewer@example.com', userId: 'user-3' },
    });

    expect(removed.ok && removed.data.email).toBe('viewer@example.com');

    const listed = await client.users.list();

    expect(listed.ok && listed.data.users.some((user) => user.id === 'user-3')).toBe(false);
  });

  it('gửi lại lời mời đẩy hạn về phía trước', async () => {
    const client = createMockApiClient();

    const resent = await client.users.resendInvite({ inviteId: 'user-7' });

    expect(resent.ok && resent.data.inviteExpiresAt).toBe(MOCK_USERS_INVITE_EXPIRY);
    expect(resent.ok && resent.data.invitedAt).toBe(MOCK_USERS_REFERENCE_TIME);
  });

  it('một id không tồn tại là 404, không phải một bản ghi rỗng', async () => {
    const client = createMockApiClient();

    const result = await client.users.disable({ userId: 'khong-co-nguoi-nay' });

    expect(result.ok).toBe(false);
    expect(!result.ok && 'status' in result.error && result.error.status).toBe(404);
  });

  it('mỗi lượt createMockApiClient() giữ trạng thái riêng', async () => {
    const first = createMockApiClient();
    await first.users.disable({ userId: 'user-2' });

    const second = createMockApiClient();
    const enabledElsewhere = await second.users.changeRole({ body: { role: 'viewer', userId: 'user-2' } });

    expect(enabledElsewhere.ok && enabledElsewhere.data.status).toBe('active');
  });
});
