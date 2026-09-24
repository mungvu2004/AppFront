import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetAuthForTests, bootstrapSession, configureAuth, getSession, onAuthSignedOut } from '@/lib/auth';
import type { ConfigureAuthOptions } from '@/lib/auth';
import { API_BASE_PATH, ENDPOINTS } from '../endpoints';
import { createAppApiClient, createAppHttpClient, resolveApiBaseUrl, resolveUseMockApi } from '../appClient';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveUseMockApi', () => {
  it('is fail-closed: only the literal true or "true" turns it on', () => {
    expect(resolveUseMockApi(true)).toBe(true);
    expect(resolveUseMockApi('true')).toBe(true);
    expect(resolveUseMockApi('false')).toBe(false);
    expect(resolveUseMockApi('1')).toBe(false);
    expect(resolveUseMockApi('yes')).toBe(false);
    expect(resolveUseMockApi(undefined)).toBe(false);
    expect(resolveUseMockApi(null)).toBe(false);
  });

  it('reads VITE_USE_MOCK_API from the environment when no value is given', () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');
    expect(resolveUseMockApi()).toBe(true);

    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    expect(resolveUseMockApi()).toBe(false);
  });
});

describe('resolveApiBaseUrl', () => {
  it('uses VITE_API_BASE_URL when it is set', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.vidu.vn');
    expect(resolveApiBaseUrl()).toBe('https://api.vidu.vn');
  });

  it('falls back to the page origin plus the default API path otherwise', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(resolveApiBaseUrl()).toBe(
      new URL(API_BASE_PATH, globalThis.location?.origin ?? globalThis.origin).toString(),
    );
  });
});

describe('createAppApiClient', () => {
  it('answers auth.signIn from the mock fixture when VITE_USE_MOCK_API is on', async () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'true');

    const client = createAppApiClient();
    const result = await client.auth.signIn({ body: { email: 'a@b.vn', password: 'anything', rememberMe: false } });

    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('builds a real HTTP-backed client when the flag is off', () => {
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.vidu.vn');

    expect(() => createAppApiClient()).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* Gắn phiên kiểu lười + ghim chủ (F-01a §4.5)                                */
/* -------------------------------------------------------------------------- */

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body), { ...init, headers });
};

/** Thân W16 của một lượt refresh thành công, cho một người dùng bất kỳ. */
const refreshBody = (userId: string, accessToken: string): unknown => ({
  accessToken,
  expiresIn: 3600,
  roles: ['engineer'],
  user: { id: userId, name: userId },
});

/** Một người dùng khác nhau cho mỗi lượt refresh, theo thứ tự đã khai. */
const refreshSequence = (userIds: readonly string[]): (() => { accessToken: string; userId: string }) => {
  let index = 0;

  return () => {
    const userId = userIds[Math.min(index, userIds.length - 1)] ?? 'u1';
    index += 1;

    return { accessToken: `token-${userId}-${index}`, userId };
  };
};

/**
 * Bản giả của `configureAuth`: **chỉ** biết trả lời đường refresh.
 *
 * So bằng `endsWith('/auth/refresh')` chứ không bằng một đường tuyệt đối —
 * F-01b đổi đường đó từ `/auth/refresh` sang `/api/auth/refresh` trong cùng
 * đợt, và bài kiểm này không được vỡ vì một chi tiết ngoài phạm vi của nó.
 */
const createRefreshOnlyFetch = (
  next: () => { accessToken: string; userId: string },
): { calls: () => number; fetchImpl: AuthFetchImpl } => {
  let calls = 0;

  return {
    calls: () => calls,
    fetchImpl: async (input: RequestInfo | URL) => {
      const url = String(input);

      if (!url.endsWith('/auth/refresh')) {
        throw new Error(`Bản giả refresh nhận một đường ngoài dự kiến: ${url}`);
      }

      calls += 1;
      const { accessToken, userId } = next();

      return jsonResponse(refreshBody(userId, accessToken));
    },
  };
};

/**
 * Chữ ký của `fetch`, khai đủ để `mock.calls[n]` đọc được cả url lẫn init.
 *
 * `vi.fn(async () => …)` suy ra danh sách tham số RỖNG, nên `calls[0]?.[1]`
 * thành lỗi TS2493 thay vì một `RequestInit | undefined`.
 */
type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Kiểu `fetchImpl` mà `configureAuth` nhận, đọc qua **barrel** `@/lib/auth`.
 *
 * Không nhập `AuthFetch` từ `@/lib/auth/types`: barrel không xuất tên đó, nên
 * nhập thẳng là neo vào nội bộ mà F-01b sở hữu và được quyền đổi.
 */
type AuthFetchImpl = NonNullable<ConfigureAuthOptions['fetchImpl']>;

const authHeaderOf = (init: RequestInit | undefined): string | null =>
  new Headers(init?.headers).get('Authorization');

describe('createAppHttpClient', () => {
  beforeEach(() => {
    __resetAuthForTests();
    vi.stubEnv('VITE_USE_MOCK_API', 'false');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api');
  });

  afterEach(() => {
    __resetAuthForTests();
    vi.unstubAllGlobals();
  });

  it('builds without a configured session, and then sends no Authorization header', async () => {
    const platformFetch = vi.fn<FetchImpl>(async () => jsonResponse([]));
    vi.stubGlobal('fetch', platformFetch);

    expect(() => createAppHttpClient()).not.toThrow();
    expect(() => createAppApiClient()).not.toThrow();

    const result = await createAppHttpClient().get(ENDPOINTS.projects.list);

    expect(result.ok).toBe(true);
    expect(platformFetch).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(platformFetch.mock.calls[0]?.[1])).toBeNull();
  });

  it('picks up the session configured after the client was built', async () => {
    const platformFetch = vi.fn<FetchImpl>(async () => jsonResponse([]));
    vi.stubGlobal('fetch', platformFetch);

    // Thứ tự là CẢ phép kiểm, không phải thói quen dựng: client ra đời khi chưa
    // có phiên nào, `configureAuth` chạy sau nó. Đây là mệnh đề trụ của 4.5 —
    // ba móc đọc cấu hình phiên MỖI lượt gọi — và nếu ai nhấc `readAuthOptions()`
    // ra khỏi chúng thì đúng test này phải đỏ.
    const client = createAppApiClient();

    const { fetchImpl } = createRefreshOnlyFetch(refreshSequence(['u1']));
    configureAuth({ baseUrl: 'https://api.example.com', fetchImpl });
    await bootstrapSession();

    expect(getSession().status).toBe('authenticated');

    const result = await client.projects.list();

    expect(result.ok).toBe(true);
    expect(platformFetch).toHaveBeenCalledTimes(1);
    expect(String(platformFetch.mock.calls[0]?.[0])).toBe('https://api.example.com/api/projects');
    expect(authHeaderOf(platformFetch.mock.calls[0]?.[1])).toBe('Bearer token-u1-1');
  });

  it('retries a 401 exactly once, with the token the refresh produced', async () => {
    const platformFetch = vi.fn<FetchImpl>(async (_input, init) =>
      authHeaderOf(init) === 'Bearer token-u1-2'
        ? jsonResponse([])
        : jsonResponse({ code: 'TOKEN_EXPIRED', requestId: 'req-1' }, { status: 401 }),
    );
    vi.stubGlobal('fetch', platformFetch);

    const { fetchImpl } = createRefreshOnlyFetch(refreshSequence(['u1']));
    configureAuth({ baseUrl: 'https://api.example.com', fetchImpl });
    await bootstrapSession();

    const result = await createAppHttpClient().get(ENDPOINTS.projects.list);

    expect(result.ok).toBe(true);
    expect(platformFetch).toHaveBeenCalledTimes(2);
    expect(authHeaderOf(platformFetch.mock.calls[0]?.[1])).toBe('Bearer token-u1-1');
    expect(authHeaderOf(platformFetch.mock.calls[1]?.[1])).toBe('Bearer token-u1-2');
  });

  it('keeps a failed sign-in off the refresh path and off the session', async () => {
    const platformFetch = vi.fn<FetchImpl>(async () =>
      jsonResponse({ code: 'INVALID_CREDENTIALS', requestId: 'req-2' }, { status: 401 }),
    );
    vi.stubGlobal('fetch', platformFetch);

    const refresh = createRefreshOnlyFetch(refreshSequence(['u1']));
    configureAuth({ baseUrl: 'https://api.example.com', fetchImpl: refresh.fetchImpl });
    await bootstrapSession();

    const refreshCallsBefore = refresh.calls();
    const result = await createAppApiClient().auth.signIn({
      body: { email: 'a@b.vn', password: 'sai-mat-khau', rememberMe: false },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ kind: 'auth', status: 401 });
    }
    expect(refresh.calls()).toBe(refreshCallsBefore);
    expect(platformFetch).toHaveBeenCalledTimes(1);
    expect(authHeaderOf(platformFetch.mock.calls[0]?.[1])).toBeNull();
    expect(getSession().status).toBe('authenticated');
  });

  describe('ghim chủ', () => {
    it('aborts the replay when the refresh hands back a different user', async () => {
      const platformFetch = vi.fn<FetchImpl>(async () =>
        jsonResponse({ code: 'TOKEN_EXPIRED', requestId: 'req-3' }, { status: 401 }),
      );
      vi.stubGlobal('fetch', platformFetch);

      const { fetchImpl } = createRefreshOnlyFetch(refreshSequence(['u1', 'u2']));
      configureAuth({ baseUrl: 'https://api.example.com', fetchImpl });
      await bootstrapSession();
      expect(getSession().user?.id).toBe('u1');

      const signedOut = vi.fn();
      const unsubscribe = onAuthSignedOut(signedOut);

      const result = await createAppHttpClient().put(ENDPOINTS.projects.update('project-1'), {
        body: { name: 'Đổi tên' },
      });

      unsubscribe();

      expect(platformFetch).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('aborted');
      }
      expect(signedOut).not.toHaveBeenCalled();
      expect(getSession().user?.id).toBe('u2');
      expect(getSession().status).toBe('authenticated');
    });

    it('sends nothing at all once the pinned owner has changed', async () => {
      const platformFetch = vi.fn<FetchImpl>(async () => jsonResponse([]));
      vi.stubGlobal('fetch', platformFetch);

      const { fetchImpl } = createRefreshOnlyFetch(refreshSequence(['u1', 'u2']));
      configureAuth({ baseUrl: 'https://api.example.com', fetchImpl });
      await bootstrapSession();

      const sentAsU1 = createAppHttpClient();
      const builtAsU1 = createAppHttpClient();

      expect((await sentAsU1.get(ENDPOINTS.projects.list)).ok).toBe(true);
      expect(platformFetch).toHaveBeenCalledTimes(1);

      await bootstrapSession();
      expect(getSession().user?.id).toBe('u2');
      platformFetch.mockClear();

      const afterSend = await sentAsU1.get(ENDPOINTS.projects.list);
      const afterBuildOnly = await builtAsU1.get(ENDPOINTS.projects.list);

      expect(platformFetch).not.toHaveBeenCalled();
      expect(afterSend.ok).toBe(false);
      if (!afterSend.ok) {
        expect(afterSend.error.kind).toBe('aborted');
      }
      expect(afterBuildOnly.ok).toBe(false);
      if (!afterBuildOnly.ok) {
        expect(afterBuildOnly.error.kind).toBe('aborted');
      }
    });
  });
});
