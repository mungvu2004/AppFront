import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';

import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  MarkNotificationsReadSchema,
  NOTIFICATION_KINDS,
  NOTIFICATION_PLACES,
  NotificationSchema,
  type NotificationWire,
} from '../schemas/notifications';
import { createMockApiClient, MOCK_NOTIFICATIONS } from '../__mocks__/client';

/* -------------------------------------------------------------------------- */
/* Bộ dựng dùng chung.                                                         */
/* -------------------------------------------------------------------------- */

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const httpError: HttpError = {
  kind: 'http',
  raw: undefined,
  requestId: 'req-notifications-1',
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

const aiCompletedWire: NotificationWire = {
  createdAt: '2026-09-08T08:40:00.000Z',
  floorId: 'L1',
  id: 'notif-1',
  isRead: false,
  kind: 'aiCompleted',
  message: 'AI đã xử lý xong bản vẽ tầng trệt của Chung cư Sông Hàn.',
  objectLabel: 'tầng trệt',
  place: 'walls',
  projectId: 'project-1',
  projectName: 'Chung cư Sông Hàn',
};

const commentMentionWire: NotificationWire = {
  createdAt: '2026-09-06T16:20:00.000Z',
  excerpt: 'Kiểm tra lại kích thước cửa sổ ở góc này giúp mình nhé.',
  floorId: 'L1',
  id: 'notif-4',
  isRead: true,
  kind: 'commentMention',
  message: 'Trần Chi nhắc đến bạn trong một bình luận ở phòng 201.',
  objectLabel: 'phòng 201',
  place: 'rooms',
  projectId: 'project-1',
  projectName: 'Chung cư Sông Hàn',
};

const projectInviteWire: NotificationWire = {
  createdAt: '2026-09-07T09:00:00.000Z',
  id: 'notif-3',
  isRead: false,
  kind: 'projectInvite',
  message: 'Bạn được mời tham gia dự án Trường mầm non Hoa Sữa với vai trò kỹ sư.',
  objectLabel: 'lời mời tham gia dự án',
  place: 'projectSettings',
  projectId: 'project-3',
  projectName: 'Trường mầm non Hoa Sữa',
};

/* -------------------------------------------------------------------------- */
/* T-09 — schema.                                                              */
/* -------------------------------------------------------------------------- */

describe('NotificationSchema', () => {
  it('decodes an item and keeps every field', () => {
    expect(NotificationSchema.parse(aiCompletedWire)).toEqual({
      createdAt: '2026-09-08T08:40:00.000Z',
      floorId: 'L1',
      id: 'notif-1',
      isRead: false,
      kind: 'aiCompleted',
      message: 'AI đã xử lý xong bản vẽ tầng trệt của Chung cư Sông Hàn.',
      objectLabel: 'tầng trệt',
      place: 'walls',
      projectId: 'project-1',
      projectName: 'Chung cư Sông Hàn',
    });
  });

  it('keeps the excerpt on a comment mention', () => {
    const parsed = NotificationSchema.parse(commentMentionWire);

    expect(parsed.kind).toBe('commentMention');
    expect(parsed.excerpt).toBe('Kiểm tra lại kích thước cửa sổ ở góc này giúp mình nhé.');
  });

  it('drops floorId and excerpt rather than filling them in when absent', () => {
    const parsed = NotificationSchema.parse(projectInviteWire);

    expect('floorId' in parsed).toBe(false);
    expect('excerpt' in parsed).toBe(false);
  });

  it('lists exactly the four kinds already chốt for the screen', () => {
    expect([...NOTIFICATION_KINDS]).toEqual([
      'aiCompleted',
      'violationFound',
      'projectInvite',
      'commentMention',
    ]);
  });

  it('rejects a fifth kind', () => {
    expect(NotificationSchema.safeParse({ ...aiCompletedWire, kind: 'morningDigest' }).success).toBe(false);
  });

  it('rejects an empty message or object label', () => {
    expect(NotificationSchema.safeParse({ ...aiCompletedWire, message: '' }).success).toBe(false);
    expect(NotificationSchema.safeParse({ ...aiCompletedWire, objectLabel: '' }).success).toBe(false);
  });

  it('rejects a timestamp that is not ISO 8601 with an offset', () => {
    expect(NotificationSchema.safeParse({ ...aiCompletedWire, createdAt: '08/09/2026' }).success).toBe(false);
  });

  it('is strict: an unmodelled field stops at this layer', () => {
    expect(NotificationSchema.safeParse({ ...aiCompletedWire, priority: 'high' }).success).toBe(false);
  });

  it('lists the nine places a notification may point at', () => {
    expect([...NOTIFICATION_PLACES]).toEqual([
      'walls',
      'objects',
      'dimensions',
      'grids',
      'rooms',
      'thickness',
      'floors',
      'rules',
      'projectSettings',
    ]);
  });

  it('requires place: a packet without one is refused, never given a default', () => {
    const withoutPlace: Record<string, unknown> = { ...aiCompletedWire };
    delete withoutPlace['place'];

    expect(NotificationSchema.safeParse(withoutPlace).success).toBe(false);
  });

  it('rejects a tenth place', () => {
    expect(NotificationSchema.safeParse({ ...aiCompletedWire, place: 'dashboard' }).success).toBe(false);
  });

  it('does not tie place to kind: the same kind may point at different screens', () => {
    const asGrids = NotificationSchema.parse({ ...aiCompletedWire, place: 'grids' });

    expect(asGrids.kind).toBe('aiCompleted');
    expect(asGrids.place).toBe('grids');
  });
});

describe('MarkNotificationsReadSchema', () => {
  it('accepts one or many ids', () => {
    expect(MarkNotificationsReadSchema.parse({ ids: ['notif-1', 'notif-2'] })).toEqual({
      ids: ['notif-1', 'notif-2'],
    });
  });

  it('rejects an empty list — that is not a request to mark nothing', () => {
    expect(MarkNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* T-09 — đường dẫn.                                                           */
/* -------------------------------------------------------------------------- */

describe('ENDPOINTS.notifications', () => {
  it('reads the inbox off a flat path, no parameter', () => {
    expect(ENDPOINTS.notifications.list).toBe('/notifications');
  });

  it('keeps markRead and markAllRead as two distinct paths', () => {
    expect(ENDPOINTS.notifications.markRead).toBe('/notifications/read');
    expect(ENDPOINTS.notifications.markAllRead).toBe('/notifications/read-all');
  });

  it('exposes the SSE stream address alongside every other path', () => {
    expect(ENDPOINTS.notifications.stream).toBe('/notifications/stream');
  });

  it('addresses acceptInvite off the notification, not off an invite resource', () => {
    expect(ENDPOINTS.notifications.acceptInvite('notif-3')).toBe('/notifications/notif-3/accept-invite');
  });
});

/* -------------------------------------------------------------------------- */
/* NotificationsApi — bốn phương thức.                                        */
/* -------------------------------------------------------------------------- */

describe('NotificationsApi', () => {
  it('reads the inbox through NotificationSchema', async () => {
    const { calls, http } = createHttpMock({ 'GET /notifications': [aiCompletedWire, projectInviteWire] });

    const result = await createApiClient(http).notifications.list();

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toHaveLength(2);
    expect(result.ok && result.data[0]?.projectName).toBe('Chung cư Sông Hàn');
    expect(calls).toEqual([{ body: undefined, method: 'GET', path: '/notifications' }]);
  });

  it('drops an item that carries no place rather than routing it somewhere invented', async () => {
    const withoutPlace: Record<string, unknown> = { ...projectInviteWire };
    delete withoutPlace['place'];

    const { http } = createHttpMock({
      'GET /notifications': [aiCompletedWire, aiCompletedWire, aiCompletedWire, aiCompletedWire, withoutPlace],
    });

    const result = await createApiClient(http).notifications.list();

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toHaveLength(4);
    expect(result.ok && result.data.every((item) => item.id === 'notif-1')).toBe(true);
  });

  it('drops one broken item instead of emptying the whole inbox', async () => {
    const { http } = createHttpMock({
      'GET /notifications': [
        aiCompletedWire,
        aiCompletedWire,
        aiCompletedWire,
        aiCompletedWire,
        { ...projectInviteWire, kind: 'other' },
      ],
    });

    const result = await createApiClient(http).notifications.list();

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toHaveLength(4);
  });

  it('posts a batch of ids to the read path and reports void', async () => {
    const { calls, http } = createHttpMock({ 'POST /notifications/read': {} });

    const result = await createApiClient(http).notifications.markRead({ body: { ids: ['notif-1', 'notif-2'] } });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeUndefined();
    expect(calls[0]).toEqual({
      body: { ids: ['notif-1', 'notif-2'] },
      method: 'POST',
      path: '/notifications/read',
    });
  });

  it('posts to the read-all path with no body ids', async () => {
    const { calls, http } = createHttpMock({ 'POST /notifications/read-all': {} });

    const result = await createApiClient(http).notifications.markAllRead();

    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual({ body: {}, method: 'POST', path: '/notifications/read-all' });
  });

  it('accepts an invite by notification id and decodes the changed record', async () => {
    const { calls, http } = createHttpMock({
      'POST /notifications/notif-3/accept-invite': { ...projectInviteWire, isRead: true },
    });

    const result = await createApiClient(http).notifications.acceptInvite({ notificationId: 'notif-3' });

    expect(result.ok && result.data.isRead).toBe(true);
    expect(calls[0]).toEqual({ body: {}, method: 'POST', path: '/notifications/notif-3/accept-invite' });
  });

  it('passes a transport failure through untouched on all four methods', async () => {
    const client = createApiClient(createFailingHttpMock());

    const results = [
      await client.notifications.list(),
      await client.notifications.markRead({ body: { ids: ['notif-1'] } }),
      await client.notifications.markAllRead(),
      await client.notifications.acceptInvite({ notificationId: 'notif-3' }),
    ];

    expect(results).toHaveLength(4);
    results.forEach((result) => {
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toBe(httpError);
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Bộ mẫu.                                                                     */
/* -------------------------------------------------------------------------- */

describe('bộ mẫu notifications', () => {
  it('đủ bốn loại và mọi bản ghi đi qua được NotificationSchema', () => {
    expect(new Set(MOCK_NOTIFICATIONS.map((item) => item.kind))).toEqual(new Set(NOTIFICATION_KINDS));
    MOCK_NOTIFICATIONS.forEach((item) => {
      expect(NotificationSchema.safeParse(item).success).toBe(true);
    });
  });

  it('chỉ commentMention mang excerpt, chỉ projectInvite thiếu floorId', () => {
    MOCK_NOTIFICATIONS.forEach((item) => {
      if (item.kind === 'commentMention') {
        expect(item.excerpt).toBeDefined();
      } else {
        expect(item.excerpt).toBeUndefined();
      }

      if (item.kind === 'projectInvite') {
        expect(item.floorId).toBeUndefined();
      } else {
        expect(item.floorId).toBeDefined();
      }
    });
  });

  it('tên dự án của bộ mẫu là tiếng Việt có dấu', () => {
    const diacritics = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

    expect(MOCK_NOTIFICATIONS.every((item) => diacritics.test(item.projectName) || diacritics.test(item.message))).toBe(
      true,
    );
  });

  it('đánh dấu đã đọc một mục không đụng tới các mục còn lại', async () => {
    const client = createMockApiClient();

    const before = await client.notifications.list();
    const unreadBefore = before.ok ? before.data.filter((item) => !item.isRead).length : 0;

    await client.notifications.markRead({ body: { ids: ['notif-1'] } });

    const after = await client.notifications.list();

    expect(after.ok && after.data.find((item) => item.id === 'notif-1')?.isRead).toBe(true);
    expect(after.ok && after.data.filter((item) => !item.isRead).length).toBe(unreadBefore - 1);
  });

  it('đánh dấu tất cả đã đọc thì không còn mục nào chưa đọc', async () => {
    const client = createMockApiClient();

    await client.notifications.markAllRead();
    const result = await client.notifications.list();

    expect(result.ok && result.data.every((item) => item.isRead)).toBe(true);
  });

  it('chấp nhận lời mời trả về đúng mục vừa đổi, đã đánh dấu đã đọc', async () => {
    const client = createMockApiClient();

    const accepted = await client.notifications.acceptInvite({ notificationId: 'notif-3' });

    expect(accepted.ok && accepted.data.kind).toBe('projectInvite');
    expect(accepted.ok && accepted.data.isRead).toBe(true);
  });

  it('một id không tồn tại là 404, không phải một bản ghi rỗng', async () => {
    const client = createMockApiClient();

    const result = await client.notifications.acceptInvite({ notificationId: 'khong-ton-tai' });

    expect(result.ok).toBe(false);
    expect(!result.ok && 'status' in result.error && result.error.status).toBe(404);
  });

  it('mỗi lượt createMockApiClient() giữ trạng thái riêng', async () => {
    const first = createMockApiClient();
    await first.notifications.markAllRead();

    const second = createMockApiClient();
    const result = await second.notifications.list();

    expect(result.ok && result.data.some((item) => !item.isRead)).toBe(true);
  });
});
