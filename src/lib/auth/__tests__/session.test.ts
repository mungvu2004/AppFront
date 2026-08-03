import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_SIGNED_OUT_EVENT, __resetAuthForTests, bootstrapSession, configureAuth, createAuthHttpClient, getSession, signOut } from '../index';
import type { AuthFetch } from '../types';

type BroadcastMessage = { data: unknown };

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

const makeJsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
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

describe('src/lib/auth/session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T00:00:00Z'));
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel as never);
    setVisibilityState('visible');
  });

  afterEach(() => {
    __resetAuthForTests();
    MockBroadcastChannel.reset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('replays five concurrent 401 requests after one refresh', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === '/auth/refresh') {
        refreshCalls += 1;
        return makeJsonResponse({
          accessToken: refreshCalls === 2 ? 'fresh-token' : 'initial-token',
          expiresIn: 3600,
          roles: ['engineer'],
          user: { id: 'user-1', name: 'engineer' },
        });
      }

      const auth = new Headers(init?.headers).get('Authorization');
      if (auth === 'Bearer fresh-token') {
        return makeJsonResponse({ ok: true, path: url.pathname });
      }

      return makeJsonResponse({ code: 'EXPIRED' }, { status: 401 });
    });
    const fetchImpl: AuthFetch = fetchMock;

    configureAuth({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    await bootstrapSession();
    expect(getSession().status).toBe('authenticated');
    expect(refreshCalls).toBe(1);

    fetchMock.mockClear();

    const client = createAuthHttpClient({ baseUrl: 'https://api.example.com' });
    const results = await Promise.all(
      ['/a', '/b', '/c', '/d', '/e'].map((path) =>
        client.get<{ ok: boolean; path: string }>(path, {
          disableSingleFlight: true,
        }),
      ),
    );

    expect(refreshCalls).toBe(2);
    expect(fetchMock.mock.calls).toHaveLength(11);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('marks queued requests unauthenticated when refresh fails', async () => {
    let refreshCalls = 0;
    const signedOutSpy = vi.fn();
    window.addEventListener(AUTH_SIGNED_OUT_EVENT, signedOutSpy as EventListener);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.pathname === '/auth/refresh') {
        refreshCalls += 1;
        if (refreshCalls === 1) {
          return makeJsonResponse({
            accessToken: 'fresh-token',
            expiresIn: 3600,
            roles: ['engineer'],
            user: { id: 'user-1' },
          });
        }

        return makeJsonResponse({ code: 'REFRESH_EXPIRED' }, { status: 401 });
      }

      return makeJsonResponse({ code: 'EXPIRED' }, { status: 401 });
    });
    const fetchImpl: AuthFetch = fetchMock;

    configureAuth({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    await bootstrapSession();
    expect(getSession().status).toBe('authenticated');

    fetchMock.mockClear();
    signedOutSpy.mockClear();

    const client = createAuthHttpClient({ baseUrl: 'https://api.example.com' });
    const results = await Promise.all(
      ['/a', '/b', '/c', '/d', '/e'].map((path) =>
        client.get<{ ok: boolean }>(path, {
          disableSingleFlight: true,
        }),
      ),
    );

    expect(refreshCalls).toBe(2);
    expect(getSession().status).toBe('anonymous');
    expect(signedOutSpy).toHaveBeenCalledTimes(1);
    expect(results.every((result) => !result.ok && result.error.kind === 'unauthenticated')).toBe(true);
    expect(fetchMock.mock.calls).toHaveLength(6);

    window.removeEventListener(AUTH_SIGNED_OUT_EVENT, signedOutSpy as EventListener);
  });

  it('refreshes 60 seconds before expiry', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname !== '/auth/refresh') {
        return makeJsonResponse({ code: 'NOT_ALLOWED' }, { status: 400 });
      }

      refreshCalls += 1;
      return makeJsonResponse({
        accessToken: `token-${refreshCalls}`,
        expiresIn: 120,
        roles: ['admin'],
        user: { id: 'user-1' },
      });
    });
    const fetchImpl: AuthFetch = fetchMock;

    configureAuth({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    await bootstrapSession();
    expect(refreshCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(refreshCalls).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(refreshCalls).toBe(2);
  });

  it('pauses proactive refresh while hidden and resumes on visibilitychange', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname !== '/auth/refresh') {
        return makeJsonResponse({ code: 'NOT_ALLOWED' }, { status: 400 });
      }

      refreshCalls += 1;
      return makeJsonResponse({
        accessToken: `token-${refreshCalls}`,
        expiresIn: 120,
        roles: ['admin'],
        user: { id: 'user-1' },
      });
    });
    const fetchImpl: AuthFetch = fetchMock;

    configureAuth({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    await bootstrapSession();
    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(120_000);
    expect(refreshCalls).toBe(1);

    setVisibilityState('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();

    expect(refreshCalls).toBe(2);
  });

  it('signs out by clearing memory, aborting requests, clearing cache, and broadcasting', async () => {
    const clearQueryCache = vi.fn(async () => {
      throw new Error('cache failed');
    });
    const messages: unknown[] = [];
    const channel = new MockBroadcastChannel('auth');
    channel.addEventListener('message', (event) => {
      messages.push(event.data);
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === '/auth/refresh') {
        return makeJsonResponse({
          accessToken: 'fresh-token',
          expiresIn: 3600,
          roles: ['admin'],
          user: { id: 'user-1' },
        });
      }

      if (url.pathname === '/auth/logout') {
        return makeJsonResponse({ ok: true });
      }

      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            reject(signal.reason);
          },
          { once: true },
        );
      });
    });
    const fetchImpl: AuthFetch = fetchMock;

    configureAuth({
      baseUrl: 'https://api.example.com',
      clearQueryCache,
      fetchImpl,
    });

    await bootstrapSession();
    const client = createAuthHttpClient({ baseUrl: 'https://api.example.com' });
    const pending = client.get<{ ok: boolean }>('/slow', {
      disableSingleFlight: true,
    });

    await flush();
    await signOut();
    const result = await pending;

    expect(clearQueryCache).toHaveBeenCalledTimes(1);
    expect(getSession().status).toBe('anonymous');
    expect(messages).toContainEqual({ type: 'signed-out' });
    expect(fetchMock.mock.calls.some(([input]) => new URL(String(input)).pathname === '/auth/logout')).toBe(true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('aborted');
    }
  });

  it('syncs sign-in and sign-out across tabs', async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname !== '/auth/refresh') {
        return makeJsonResponse({ code: 'NOT_ALLOWED' }, { status: 400 });
      }

      refreshCalls += 1;
      return makeJsonResponse({
        accessToken: `token-${refreshCalls}`,
        expiresIn: 3600,
        roles: ['engineer'],
        user: { id: 'user-1' },
      });
    });
    const fetchImpl: AuthFetch = fetchMock;

    configureAuth({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const channel = new MockBroadcastChannel('auth');
    channel.postMessage({ type: 'signed-in' });
    await flush();

    expect(refreshCalls).toBe(1);
    expect(getSession().status).toBe('authenticated');

    channel.postMessage({ type: 'signed-out' });
    await flush();

    expect(getSession().status).toBe('anonymous');
  });
});


