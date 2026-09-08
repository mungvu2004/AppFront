import { describe, expect, it, vi } from 'vitest';

import type { AdminUser, AdminUserList, ApiResult, UserActivity, UserMembership, UsersApi } from '@/api/client';
import type { HttpError } from '@/lib/http';

import { resolveCachePolicy } from '../cachePolicy';
import { applyInvalidation, invalidationMap, WRITE_OPERATIONS } from '../invalidation';
import { createQueryClient } from '../queryClient';
import { queryKeys } from '../queryKeys';
import {
  userActivityQueryOptions,
  userMembershipsQueryOptions,
  usersListQueryOptions,
} from '../usersQueries';

const sampleUser: AdminUser = {
  email: 'engineer@example.com',
  id: 'user-2',
  lastActiveAt: '2026-09-08T05:30:00.000Z',
  name: 'Nguyễn Bình',
  projectCount: 4,
  role: 'engineer',
  status: 'active',
};

const sampleList: AdminUserList = { total: 137, users: [sampleUser] };

const sampleMembership: UserMembership = {
  projectId: 'project-1',
  projectName: 'Chung cư Sông Hàn',
  role: 'engineer',
};

const sampleActivity: UserActivity = {
  at: '2026-09-08T05:28:00.000Z',
  id: 'activity-3',
  kind: 'wall.edit',
  objectCode: 'A-3',
  objectLabel: 'sửa tường trục a-3',
};

const forbidden: HttpError = {
  kind: 'http',
  raw: undefined,
  requestId: 'req-users-list',
  retryable: false,
  status: 403,
};

const createUsersApi = (
  overrides: Partial<UsersApi> = {},
): Pick<UsersApi, 'activity' | 'list' | 'memberships'> & {
  activity: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  memberships: ReturnType<typeof vi.fn>;
} => {
  const list = vi.fn(async (): Promise<ApiResult<AdminUserList>> => ({ ok: true, data: sampleList }));
  const memberships = vi.fn(
    async (): Promise<ApiResult<UserMembership[]>> => ({ ok: true, data: [sampleMembership] }),
  );
  const activity = vi.fn(
    async (): Promise<ApiResult<UserActivity[]>> => ({ ok: true, data: [sampleActivity] }),
  );

  return { activity, list, memberships, ...overrides } as Pick<
    UsersApi,
    'activity' | 'list' | 'memberships'
  > & {
    activity: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    memberships: ReturnType<typeof vi.fn>;
  };
};

/** `queryFn` cần một ngữ cảnh; chỉ `signal` được đọc, phần còn lại không dùng tới. */
const callQueryFn = async <TData>(
  options: { queryFn: (context: never) => TData | Promise<TData>; queryKey: readonly unknown[] },
  signal: AbortSignal = new AbortController().signal,
): Promise<TData> =>
  options.queryFn({
    client: undefined,
    meta: undefined,
    queryKey: options.queryKey,
    signal,
  } as never);

describe('usersListQueryOptions', () => {
  it('reads the whole table under the existing user.list key', async () => {
    const usersApi = createUsersApi();
    const options = usersListQueryOptions(usersApi);

    expect(options.queryKey).toEqual(queryKeys.user.list());
    await expect(callQueryFn(options)).resolves.toEqual(sampleList);
    expect(usersApi.list).toHaveBeenCalledTimes(1);
  });

  it('hands total through rather than unwrapping to a bare array', async () => {
    const data = await callQueryFn(usersListQueryOptions(createUsersApi()));

    expect(data.total).toBe(137);
    expect(data.users).toHaveLength(1);
  });

  it('passes the abort signal straight down to the client', async () => {
    const usersApi = createUsersApi();
    const controller = new AbortController();

    await callQueryFn(usersListQueryOptions(usersApi), controller.signal);

    expect(usersApi.list).toHaveBeenCalledWith({ signal: controller.signal });
  });

  it('throws the HttpError untouched, so retry rules can read `retryable`', async () => {
    const usersApi = createUsersApi({
      list: vi.fn(async (): Promise<ApiResult<AdminUserList>> => ({ ok: false, error: forbidden })),
    });

    await expect(callQueryFn(usersListQueryOptions(usersApi))).rejects.toBe(forbidden);
  });
});

describe('userMembershipsQueryOptions and userActivityQueryOptions', () => {
  it('key both reads by userId, so two people are two cache entries', () => {
    const usersApi = createUsersApi();

    expect(userMembershipsQueryOptions(usersApi, 'user-2').queryKey).toEqual(
      queryKeys.user.memberships('user-2'),
    );
    expect(userActivityQueryOptions(usersApi, 'user-2').queryKey).toEqual(
      queryKeys.user.activity('user-2'),
    );
    expect(userMembershipsQueryOptions(usersApi, 'user-2').queryKey).not.toEqual(
      userMembershipsQueryOptions(usersApi, 'user-3').queryKey,
    );
  });

  it('fetches through the client and forwards the id', async () => {
    const usersApi = createUsersApi();
    const controller = new AbortController();

    const memberships = await callQueryFn(
      userMembershipsQueryOptions(usersApi, 'user-2'),
      controller.signal,
    );
    const activity = await callQueryFn(userActivityQueryOptions(usersApi, 'user-2'), controller.signal);

    expect(memberships).toEqual([sampleMembership]);
    expect(activity).toEqual([sampleActivity]);
    expect(usersApi.memberships).toHaveBeenCalledWith({ signal: controller.signal, userId: 'user-2' });
    expect(usersApi.activity).toHaveBeenCalledWith({ signal: controller.signal, userId: 'user-2' });
  });

  it('lets one panel fail while the other stays right — the "partial" state of A11', async () => {
    const usersApi = createUsersApi({
      activity: vi.fn(async (): Promise<ApiResult<UserActivity[]>> => ({ ok: false, error: forbidden })),
    });

    await expect(callQueryFn(userActivityQueryOptions(usersApi, 'user-2'))).rejects.toBe(forbidden);
    await expect(callQueryFn(userMembershipsQueryOptions(usersApi, 'user-2'))).resolves.toEqual([
      sampleMembership,
    ]);
  });
});

describe('chính sách cache của ba khoá mới', () => {
  it('cả ba nằm dưới miền user, nên chúng nhận đúng bậc static đã có', () => {
    [
      queryKeys.user.list(),
      queryKeys.user.memberships('user-2'),
      queryKeys.user.activity('user-2'),
    ].forEach((queryKey) => {
      expect(queryKey[0]).toBe('user');
      expect(resolveCachePolicy(queryKey).tier).toBe('static');
    });
  });

  it('không con số thời gian nào mới: bậc của khoá mới trùng bậc của user.current đã có', () => {
    expect(resolveCachePolicy(queryKeys.user.activity('user-2'))).toEqual(
      resolveCachePolicy(queryKeys.user.current()),
    );
  });
});

describe('làm mất hiệu lực sau năm lượt ghi của quản trị người dùng', () => {
  it('khai đủ năm thao tác, và bản đồ không lệch khỏi danh sách', () => {
    ['inviteUsers', 'changeUserRole', 'setUserEnabled', 'removeUser', 'resendInvite'].forEach(
      (operation) => {
        expect(WRITE_OPERATIONS).toContain(operation);
      },
    );
    expect(Object.keys(invalidationMap).sort()).toEqual([...WRITE_OPERATIONS].sort());
  });

  it('cả năm đều làm cũ danh sách', () => {
    expect(invalidationMap.inviteUsers({})).toEqual([queryKeys.user.list()]);
    expect(invalidationMap.resendInvite({})).toEqual([queryKeys.user.list()]);
    expect(invalidationMap.changeUserRole({ userId: 'user-2' })).toContainEqual(queryKeys.user.list());
    expect(invalidationMap.setUserEnabled({ userId: 'user-2' })).toContainEqual(queryKeys.user.list());
    expect(invalidationMap.removeUser({ userId: 'user-2' })).toContainEqual(queryKeys.user.list());
  });

  it('đổi vai không viết lại nhật ký, nhưng xoá người thì có', () => {
    expect(invalidationMap.changeUserRole({ userId: 'user-2' })).toEqual([
      queryKeys.user.list(),
      queryKeys.user.memberships('user-2'),
    ]);
    expect(invalidationMap.removeUser({ userId: 'user-2' })).toEqual([
      queryKeys.user.list(),
      queryKeys.user.memberships('user-2'),
      queryKeys.user.activity('user-2'),
    ]);
  });

  it('đụng đúng người được nêu, không đụng người bên cạnh', () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(queryKeys.user.list(), { total: 0, users: [] });
    queryClient.setQueryData(queryKeys.user.memberships('user-2'), []);
    queryClient.setQueryData(queryKeys.user.memberships('user-3'), []);

    applyInvalidation(queryClient, 'changeUserRole', { userId: 'user-2' });

    expect(queryClient.getQueryState(queryKeys.user.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.user.memberships('user-2'))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.user.memberships('user-3'))?.isInvalidated).toBeFalsy();
  });
});
