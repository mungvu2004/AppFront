import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETRY_MIN_DELAY_MS, __resetLastKnownUserForTests } from '../bootstrap';
import { REFRESH_MAX_TRANSIENT_ATTEMPTS } from '../refresh';
import {
  AUTH_SIGNED_IN_EVENT,
  AUTH_SIGNED_OUT_EVENT,
  __resetAuthForTests,
  bootstrapSession,
  configureAuth,
  createAuthHttpClient,
  getAccessToken,
  getSession,
  refreshSingleFlight,
  signOut,
} from '../index';
import type { ConfigureAuthOptions } from '../index';
import type { AuthFetch } from '../types';

interface BroadcastMessage {
  data: unknown;
}

class MockBroadcastChannel {
  private static channels = new Map<string, Set<MockBroadcastChannel>>();

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }

  readonly name: string;
  private listeners = new Set<(event: BroadcastMessage) => void>();

  constructor(name: string) {
    this.name = name;
    const channels = MockBroadcastChannel.channels.get(name) ?? new Set<MockBroadcastChannel>();
    channels.add(this);
    MockBroadcastChannel.channels.set(name, channels);
  }

  addEventListener(_type: 'message', listener: (event: BroadcastMessage) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: BroadcastMessage) => void): void {
    this.listeners.delete(listener);
  }

  postMessage(data: unknown): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    channels?.forEach((channel) => {
      if (channel === this) {
        return;
      }

      channel.listeners.forEach((listener) => listener({ data }));
    });
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

const BASE_URL = 'https://may-chu.vn/api';
const NOW_ISO = '2026-08-03T00:00:00.000Z';

const makeJsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body), { ...init, headers });
};

const setVisibilityState = (state: 'hidden' | 'visible'): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => state === 'hidden',
  });
};

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

/** Thân W16 của một lượt gia hạn thành công (B1-01 #3). */
const w16Body = (userId: string, accessToken: string): unknown => ({
  accessToken,
  expiresAt: '2026-08-03T00:10:00.000Z',
  roles: ['engineer'],
  user: { email: `${userId}@vd.vn`, id: userId, name: 'Kỹ sư' },
});

/** Thân lỗi mà máy chủ trả cho một lượt gia hạn hỏng. */
const errorBody = (code: string): unknown => ({ code, message: code });

/** Một lượt trả lời của máy chủ, khai theo thứ tự lượt gọi. */
type RefreshTurn = (signal: AbortSignal | null) => Promise<Response>;

const ok = (userId = 'u1', accessToken = 'token-1'): RefreshTurn => async () =>
  makeJsonResponse(w16Body(userId, accessToken));

const failWith = (status: number, code: string, headers: HeadersInit = {}): RefreshTurn =>
  async () => makeJsonResponse(errorBody(code), { headers, status });

/**
 * Bản giả của máy chủ phiên: ghi lại đường thật, và trả lời theo kịch bản.
 *
 * Lượt cuối của kịch bản được lặp lại mãi, nên một bài kiểm chỉ phải khai
 * những lượt nó thật sự quan tâm.
 */
const createAuthServer = (
  turns: readonly RefreshTurn[],
): {
  fetchImpl: AuthFetch;
  refreshCalls: () => number;
  urls: string[];
} => {
  const urls: string[] = [];
  let refreshCalls = 0;

  const fetchImpl: AuthFetch = async (input, init) => {
    const url = String(input);
    urls.push(url);

    if (url.endsWith('/auth/logout')) {
      return new Response(null, { status: 204 });
    }

    const turn = turns[Math.min(refreshCalls, turns.length - 1)] ?? ok();
    refreshCalls += 1;

    return turn(init?.signal ?? null);
  };

  return { fetchImpl, refreshCalls: () => refreshCalls, urls };
};

const configure = (fetchImpl: AuthFetch, overrides: Partial<ConfigureAuthOptions> = {}): void => {
  configureAuth({ baseUrl: BASE_URL, fetchImpl, ...overrides });
};

describe('src/lib/auth/refresh', () => {
  let signedOut: ReturnType<typeof vi.fn>;
  let signedIn: ReturnType<typeof vi.fn>;
  let otherTab: unknown[];
  let otherTabChannel: MockBroadcastChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel as never);
    setVisibilityState('visible');
    __resetAuthForTests();
    __resetLastKnownUserForTests();

    signedOut = vi.fn();
    signedIn = vi.fn();
    window.addEventListener(AUTH_SIGNED_OUT_EVENT, signedOut as EventListener);
    window.addEventListener(AUTH_SIGNED_IN_EVENT, signedIn as EventListener);

    otherTab = [];
    otherTabChannel = new MockBroadcastChannel('auth');
    otherTabChannel.addEventListener('message', (event) => {
      otherTab.push(event.data);
    });
  });

  afterEach(() => {
    window.removeEventListener(AUTH_SIGNED_OUT_EVENT, signedOut as EventListener);
    window.removeEventListener(AUTH_SIGNED_IN_EVENT, signedIn as EventListener);
    otherTabChannel.close();
    __resetAuthForTests();
    __resetLastKnownUserForTests();
    MockBroadcastChannel.reset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /* ---------------------------------------------------------------- 2.1 -- */

  it('keeps the /api prefix on both session paths', async () => {
    const server = createAuthServer([ok()]);
    configure(server.fetchImpl);

    await bootstrapSession();
    await signOut();

    expect(server.urls).toEqual([
      'https://may-chu.vn/api/auth/refresh',
      'https://may-chu.vn/api/auth/logout',
    ]);
  });

  /* ---------------------------------------------------------------- 2.2 -- */

  it('signs every tab out on a 401', async () => {
    const server = createAuthServer([ok(), failWith(401, 'SESSION_REVOKED')]);
    configure(server.fetchImpl);

    await bootstrapSession();
    otherTab.length = 0;
    signedOut.mockClear();

    await refreshSingleFlight({ source: 'local' });

    expect(getSession().status).toBe('anonymous');
    expect(signedOut).toHaveBeenCalledTimes(1);
    expect(otherTab).toEqual([{ type: 'signed-out' }]);
  });

  it.each([
    ['403 ORIGIN_MISMATCH', 403, 'ORIGIN_MISMATCH'],
    ['400 BAD_REQUEST', 400, 'BAD_REQUEST'],
  ])('signs only this tab out on %s', async (_label, status, code) => {
    const server = createAuthServer([ok(), failWith(status, code)]);
    configure(server.fetchImpl);

    await bootstrapSession();
    otherTab.length = 0;
    signedOut.mockClear();

    await refreshSingleFlight({ source: 'local' });

    expect(getSession().status).toBe('anonymous');
    expect(signedOut).toHaveBeenCalledTimes(1);
    expect(otherTab).toEqual([]);
  });

  it('signs only this tab out when the W16 body is unreadable', async () => {
    const server = createAuthServer([ok(), async () => makeJsonResponse({ nothing: true })]);
    configure(server.fetchImpl);

    await bootstrapSession();
    otherTab.length = 0;

    await refreshSingleFlight({ source: 'local' });

    expect(getSession().status).toBe('anonymous');
    expect(otherTab).toEqual([]);
  });

  it.each([
    ['429 RATE_LIMITED', failWith(429, 'RATE_LIMITED', { 'Retry-After': '5' }), 0, 5_000],
    ['503 DEPENDENCY_UNAVAILABLE', failWith(503, 'DEPENDENCY_UNAVAILABLE'), 0, 1_000],
    [
      'a network TypeError',
      (async () => {
        throw new TypeError('Failed to fetch');
      }) as RefreshTurn,
      0,
      1_000,
    ],
    [
      'a request past REFRESH_TIMEOUT_MS',
      ((signal: AbortSignal | null) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        })) as RefreshTurn,
      15_000,
      1_000,
    ],
  ])('keeps the session alive through %s', async (_label, turn, failAfterMs, retryDelayMs) => {
    const server = createAuthServer([ok('u1', 'token-1'), turn, ok('u1', 'token-3')]);
    configure(server.fetchImpl);

    await bootstrapSession();
    otherTab.length = 0;
    signedOut.mockClear();

    const refreshed = refreshSingleFlight({ source: 'local' });
    await vi.advanceTimersByTimeAsync(failAfterMs);
    expect(await refreshed).toBe(false);

    expect(getSession().status).toBe('authenticated');
    expect(getSession().serverUnreachable).toBe(true);
    expect(getAccessToken()).toBe('token-1');
    expect(getSession().roles).toEqual(['engineer']);
    expect(signedOut).not.toHaveBeenCalled();
    expect(otherTab).toEqual([]);

    await vi.advanceTimersByTimeAsync(retryDelayMs);

    expect(server.refreshCalls()).toBe(3);
    expect(getSession().serverUnreachable).toBe(false);
    expect(getAccessToken()).toBe('token-3');
  });

  it('leaves an unknown session unknown when the server is unreachable', async () => {
    const server = createAuthServer([failWith(503, 'DEPENDENCY_UNAVAILABLE')]);
    configure(server.fetchImpl);

    expect(await refreshSingleFlight({ source: 'local' })).toBe(false);

    expect(getSession().status).toBe('unknown');
    expect(getSession().serverUnreachable).toBe(true);
    expect(signedOut).not.toHaveBeenCalled();
    expect(otherTab).toEqual([]);
  });

  it('backs off 1, 2, 4 seconds while the server stays down', async () => {
    const server = createAuthServer([failWith(503, 'DEPENDENCY_UNAVAILABLE')]);
    configure(server.fetchImpl);

    await refreshSingleFlight({ source: 'local' });
    expect(server.refreshCalls()).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(server.refreshCalls()).toBe(2);

    await vi.advanceTimersByTimeAsync(1_999);
    expect(server.refreshCalls()).toBe(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(server.refreshCalls()).toBe(3);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(server.refreshCalls()).toBe(4);
  });

  /**
   * Khách chưa đăng nhập đứng ở `/login` lúc máy chủ chết — chuỗi phải DỪNG.
   *
   * `startAppSession()` chạy ở mọi lượt tải trang, kể cả đường công khai. Không
   * có nhánh này thì thẻ ấy bắn `POST /auth/refresh` mỗi 60 giây, vô hạn, cho
   * một phiên không tồn tại; nhân với số khách trong một sự cố là một đàn
   * request đập vào chính máy chủ đang hồi phục.
   */
  it('stops retrying once the session is known to be anonymous', async () => {
    const server = createAuthServer([
      failWith(401, 'UNAUTHENTICATED'),
      failWith(503, 'DEPENDENCY_UNAVAILABLE'),
    ]);
    configure(server.fetchImpl);

    await bootstrapSession();
    expect(getSession().status).toBe('anonymous');
    expect(server.refreshCalls()).toBe(1);

    /* Một lượt lỗi tạm trên phiên đã ẩn danh: bật cờ, nhưng KHÔNG hẹn lượt sau. */
    await refreshSingleFlight({ reason: 'bootstrap', source: 'local' });
    expect(server.refreshCalls()).toBe(2);

    await vi.advanceTimersByTimeAsync(600_000);
    expect(server.refreshCalls()).toBe(2);
  });

  it('gives up after REFRESH_MAX_TRANSIENT_ATTEMPTS and leaves the session intact', async () => {
    const server = createAuthServer([ok('u1', 'token-1'), failWith(503, 'DEPENDENCY_UNAVAILABLE')]);
    configure(server.fetchImpl);

    await bootstrapSession();
    expect(server.refreshCalls()).toBe(1);
    otherTab.length = 0;
    signedOut.mockClear();

    await refreshSingleFlight({ source: 'local' });
    /* Thang lùi 1, 2, 4, 8, 16, 32, 60, 60 giây — chạy quá tổng của nó. */
    await vi.advanceTimersByTimeAsync(600_000);

    const transientCalls = server.refreshCalls() - 1;
    expect(transientCalls).toBe(REFRESH_MAX_TRANSIENT_ATTEMPTS);

    /* Đứng im, nhưng phiên còn nguyên và cờ vẫn nói đúng sự thật. */
    expect(getSession().status).toBe('authenticated');
    expect(getSession().serverUnreachable).toBe(true);
    expect(signedOut).not.toHaveBeenCalled();
    expect(otherTab).toEqual([]);
  });

  /**
   * Quay lại thẻ cho một THANG MỚI ĐẦY ĐỦ, không phải đúng một lượt lẻ.
   *
   * Khẳng định bằng con số chính xác chứ không bằng "lớn hơn": nếu
   * `transientAttempt` không được đặt về 0 thì lượt đầu tiên sau khi quay lại
   * sẽ chạm trần ngay và chuỗi im lại sau ĐÚNG MỘT lượt — mà "lớn hơn" thì một
   * lượt cũng đủ xanh, nên nó không khoá được gì.
   */
  it('restarts the ladder when the tab comes back into view', async () => {
    const server = createAuthServer([
      ok('u1', 'token-1'),
      failWith(503, 'DEPENDENCY_UNAVAILABLE'),
    ]);
    configure(server.fetchImpl);

    await bootstrapSession();
    await refreshSingleFlight({ source: 'local' });
    await vi.advanceTimersByTimeAsync(600_000);

    /* Lượt dựng phiên, rồi trọn một thang lùi tám lượt. */
    expect(server.refreshCalls()).toBe(1 + REFRESH_MAX_TRANSIENT_ATTEMPTS);

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(600_000);

    /* Và một thang lùi tám lượt NỮA, không phải một lượt lẻ. */
    expect(server.refreshCalls()).toBe(1 + REFRESH_MAX_TRANSIENT_ATTEMPTS * 2);
  });

  it('does not sign out on a 401 request while the server is unreachable', async () => {
    const server = createAuthServer([ok(), failWith(503, 'DEPENDENCY_UNAVAILABLE')]);
    const fetchImpl: AuthFetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh') || url.endsWith('/auth/logout')) {
        return server.fetchImpl(input, init);
      }

      return makeJsonResponse(errorBody('TOKEN_EXPIRED'), { status: 401 });
    };
    configure(fetchImpl);

    await bootstrapSession();
    await refreshSingleFlight({ source: 'local' });
    expect(getSession().serverUnreachable).toBe(true);

    signedOut.mockClear();
    otherTab.length = 0;

    const client = createAuthHttpClient({ baseUrl: BASE_URL });
    const result = await client.get('/du-an', { disableSingleFlight: true });

    expect(result.ok).toBe(false);
    expect(getSession().status).toBe('authenticated');
    expect(signedOut).not.toHaveBeenCalled();
    expect(otherTab).toEqual([]);
  });

  it('lets bootstrapSession through the refreshFailed gate', async () => {
    const server = createAuthServer([failWith(401, 'UNAUTHENTICATED'), ok('u2', 'token-2')]);
    configure(server.fetchImpl);

    expect(await bootstrapSession()).toBe(false);
    expect(getSession().status).toBe('anonymous');
    expect(server.refreshCalls()).toBe(1);

    expect(await bootstrapSession()).toBe(true);
    expect(server.refreshCalls()).toBe(2);
    expect(getSession().status).toBe('authenticated');
    expect(getSession().user?.id).toBe('u2');
  });

  it('sends nothing more once a 401 has closed the session', async () => {
    const server = createAuthServer([failWith(401, 'UNAUTHENTICATED')]);
    configure(server.fetchImpl);

    await refreshSingleFlight({ source: 'local' });
    expect(server.refreshCalls()).toBe(1);

    expect(await refreshSingleFlight({ source: 'local' })).toBe(false);
    expect(server.refreshCalls()).toBe(1);
  });

  it('seats the new user even when clearing their predecessor throws', async () => {
    const server = createAuthServer([ok('u1', 'token-1'), ok('u2', 'token-2')]);
    configure(server.fetchImpl, {
      clearUserData: () => {
        throw new Error('ổ đĩa đầy');
      },
    });

    await bootstrapSession();

    expect(await refreshSingleFlight({ source: 'local' })).toBe(true);
    expect(getSession().user?.id).toBe('u2');
  });

  it('stops without touching the session when sign-out aborts the refresh', async () => {
    const server = createAuthServer([
      ok(),
      ((signal: AbortSignal | null) =>
        new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        })) as RefreshTurn,
    ]);
    configure(server.fetchImpl);

    await bootstrapSession();
    const pending = refreshSingleFlight({ source: 'local' });
    await flush();

    await signOut();

    expect(await pending).toBe(false);
    expect(getSession().serverUnreachable).toBe(false);
    expect(getSession().status).toBe('anonymous');
  });

  /* ---------------------------------------------------------------- 2.3 -- */

  it('does not floor a 401-driven refresh behind a scheduled one', async () => {
    const server = createAuthServer([
      ok('u1', 'token-1'),
      ok('u1', 'token-2'),
      ok('u1', 'token-3'),
    ]);
    const fetchImpl: AuthFetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh') || url.endsWith('/auth/logout')) {
        return server.fetchImpl(input, init);
      }

      return new Headers(init?.headers).get('Authorization') === 'Bearer token-3'
        ? makeJsonResponse({ ok: true })
        : makeJsonResponse(errorBody('TOKEN_EXPIRED'), { status: 401 });
    };
    configure(fetchImpl);

    await bootstrapSession();

    // Lượt hẹn giờ ở giây 540, ngay trước hạn — và sàn 30 giây vừa được đặt lại.
    await vi.advanceTimersByTimeAsync(540_000);
    expect(server.refreshCalls()).toBe(2);

    const client = createAuthHttpClient({ baseUrl: BASE_URL });
    const result = await client.get('/du-an', { disableSingleFlight: true });

    expect(server.refreshCalls()).toBe(3);
    expect(result.ok).toBe(true);
  });

  /**
   * Đồng hồ nhanh chín phút, token sống 30 giây — và hai điều phải đúng CÙNG LÚC.
   *
   * Bản đầu của bài này khẳng định "tối đa 5 lượt trong 120 giây giả", con số
   * suy ra từ giả định sàn 30 giây luôn thắng. Chính giả định ấy là lỗi LOG-02:
   * với TTL 30 giây thì sàn đẩy lượt gia hạn ra ĐÚNG lúc token chết. Nay sàn bị
   * kẹp ở nửa quãng đời còn lại, nên nhịp là 15 giây và số lượt là 9 — nhiều
   * hơn, nhưng mỗi lượt đều rơi vào lúc token CÒN SỐNG, và đó mới là thứ phải
   * khoá. Số lượt vẫn có trần (không phải vòng lặp liên tục), nên lý do sàn ra
   * đời vẫn được giữ.
   */
  it('refreshes a short-lived token while it is still alive, and still bounds the rate', async () => {
    const TOKEN_TTL_MS = 30_000;
    const firedAt: number[] = [];
    const skewedFetch: AuthFetch = async () => {
      firedAt.push(Date.now());
      const serverNow = Date.now() - 540_000;

      return makeJsonResponse(
        {
          accessToken: 'token-skew',
          expiresAt: new Date(serverNow + TOKEN_TTL_MS).toISOString(),
          roles: ['engineer'],
          user: { id: 'u1' },
        },
        { headers: { Date: new Date(serverNow).toUTCString() } },
      );
    };
    const calls = vi.fn(skewedFetch);
    configure(calls);

    await bootstrapSession();
    await vi.advanceTimersByTimeAsync(120_000);

    /* Tất định: lượt dựng phiên ở giây 0, rồi tám lượt cách nhau 15 giây. */
    expect(calls.mock.calls).toHaveLength(9);

    /* Tính chất thật: không lượt nào tới sau khi token của lượt trước đã chết. */
    const gaps = firedAt.slice(1).map((at, index) => at - (firedAt[index] ?? 0));
    expect(gaps.every((gap) => gap < TOKEN_TTL_MS)).toBe(true);
    expect(Math.max(...gaps)).toBe(TOKEN_TTL_MS / 2);
  });

  /**
   * Lượt gia hạn THÀNH CÔNG trả về một token đã chết — và không được quay tít.
   *
   * Đây là đường mà trần `REFRESH_MAX_TRANSIENT_ATTEMPTS` không canh: trần ấy
   * nằm ở nhánh LỖI, còn mỗi lượt thành công lại đặt `transientAttempt` về 0.
   * Nếu sàn dưới của lịch hẹn co theo `remainingMs` thì độ trễ về 0 và vòng
   * lặp chạy hết tốc độ đồng hồ — đo được 18 lượt trong một giây giả.
   *
   * Ba đường tới được: BE trả `expiresAt` bằng hoặc trước tiêu đề `Date` của
   * chính nó, `ACCESS_TOKEN_TTL_S` đặt cực thấp, hoặc vắng `Date` cộng đồng hồ
   * máy khách nhanh hơn cả TTL. Không đường nào là triển khai đúng — và cả ba
   * đều biến lỗi của người khác thành một cú tự đập vào mình.
   */
  it('does not spin when a successful refresh hands back an already-dead token', async () => {
    const deadTokenFetch: AuthFetch = async () => {
      const serverNow = Date.now();

      return makeJsonResponse(
        {
          accessToken: 'token-dead',
          /* Hết hạn ĐÚNG lúc máy chủ trả lời: `remainingMs` bằng 0. */
          expiresAt: new Date(serverNow).toISOString(),
          roles: ['engineer'],
          user: { id: 'u1' },
        },
        { headers: { Date: new Date(serverNow).toUTCString() } },
      );
    };
    const calls = vi.fn(deadTokenFetch);
    configure(calls);

    await bootstrapSession();
    expect(calls.mock.calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000);

    /* Một giây giả cho ĐÚNG một lượt nữa, không phải cả một đàn. */
    expect(calls.mock.calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(9_000);

    /* Mười giây giả, nhịp đúng bằng sàn dưới — không nhanh hơn. */
    expect(calls.mock.calls).toHaveLength(1 + 10_000 / RETRY_MIN_DELAY_MS);
  });

  it('reads expiry against the server clock, not the fast local one', async () => {
    const skewedFetch: AuthFetch = async () => {
      const serverNow = Date.now() - 540_000;

      return makeJsonResponse(
        {
          accessToken: 'token-skew',
          expiresAt: new Date(serverNow + 600_000).toISOString(),
          roles: ['engineer'],
          user: { id: 'u1' },
        },
        { headers: { Date: new Date(serverNow).toUTCString() } },
      );
    };
    const calls = vi.fn(skewedFetch);
    configure(calls);

    await bootstrapSession();
    await vi.advanceTimersByTimeAsync(120_000);

    // Không hiệu chỉnh đồng hồ thì hạn còn lại đọc ra 60 giây và lịch hẹn quay vòng.
    expect(calls.mock.calls).toHaveLength(1);
  });

  /* ---------------------------------------------------------------- 2.4 -- */

  it('clears the query cache, then user data, then seats the new user', async () => {
    const order: string[] = [];
    const server = createAuthServer([ok('u1', 'token-1'), ok('u2', 'token-2')]);
    configure(server.fetchImpl, {
      clearQueryCache: () => {
        order.push(`cache:${getSession().user?.id ?? 'none'}`);
      },
      clearUserData: () => {
        order.push(`data:${getSession().user?.id ?? 'none'}`);
      },
    });

    await bootstrapSession();
    expect(order).toEqual([]);

    await refreshSingleFlight({ source: 'local' });

    expect(order).toEqual(['cache:u1', 'data:u1']);
    expect(getSession().user?.id).toBe('u2');
  });

  it('clears nothing when the same user comes back', async () => {
    const clearQueryCache = vi.fn();
    const clearUserData = vi.fn();
    const server = createAuthServer([ok('u1', 'token-1'), ok('u1', 'token-2')]);
    configure(server.fetchImpl, { clearQueryCache, clearUserData });

    await bootstrapSession();
    await refreshSingleFlight({ source: 'local' });

    expect(clearQueryCache).not.toHaveBeenCalled();
    expect(clearUserData).not.toHaveBeenCalled();
  });

  it('still clears when the swap goes through an anonymous session', async () => {
    const clearUserData = vi.fn();
    const server = createAuthServer([ok('u1', 'token-1'), ok('u2', 'token-2')]);
    configure(server.fetchImpl, { clearUserData });

    await bootstrapSession();
    await signOut();
    expect(getSession().status).toBe('anonymous');
    clearUserData.mockClear();

    await bootstrapSession();

    expect(clearUserData).toHaveBeenCalledTimes(1);
    expect(getSession().user?.id).toBe('u2');
  });

  it('clears when another tab announces a different user', async () => {
    const clearUserData = vi.fn();
    const server = createAuthServer([ok('u1', 'token-1'), ok('u2', 'token-2')]);
    configure(server.fetchImpl, { clearUserData });

    await bootstrapSession();
    clearUserData.mockClear();

    otherTabChannel.postMessage({ type: 'signed-in' });
    await flush();

    expect(clearUserData).toHaveBeenCalledTimes(1);
    expect(getSession().user?.id).toBe('u2');
  });

  it('announces sign-in again when the user swaps mid-session', async () => {
    const server = createAuthServer([ok('u1', 'token-1'), ok('u2', 'token-2')]);
    configure(server.fetchImpl);

    await bootstrapSession();
    expect(getSession().status).toBe('authenticated');
    signedIn.mockClear();
    otherTab.length = 0;

    await refreshSingleFlight({ source: 'local' });

    expect(signedIn).toHaveBeenCalledTimes(1);
    expect(otherTab).toEqual([{ type: 'signed-in' }]);
  });

  it('stays quiet when the same user simply renews', async () => {
    const server = createAuthServer([ok('u1', 'token-1'), ok('u1', 'token-2')]);
    configure(server.fetchImpl);

    await bootstrapSession();
    signedIn.mockClear();
    otherTab.length = 0;

    await refreshSingleFlight({ source: 'local' });

    expect(signedIn).not.toHaveBeenCalled();
    expect(otherTab).toEqual([]);
  });
});
