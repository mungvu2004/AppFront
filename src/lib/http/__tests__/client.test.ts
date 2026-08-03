import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpClient } from '../client';

describe('http/client.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('cancels requests on timeout', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
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

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const pending = client.get('/floors');
    await vi.advanceTimersByTimeAsync(15000);
    const result = await pending;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.kind).toBe('timeout');
  });

  it('retries GET exactly 3 times with the configured backoff', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const invocationTimes: number[] = [];
    const fetchImpl = vi.fn(() => {
      invocationTimes.push(Date.now());

      if (invocationTimes.length < 4) {
        return Promise.resolve(
          new Response(JSON.stringify({ code: 'TEMP' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );
    });

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const pending = client.get<{ ok: boolean }>('/plans');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(299);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(899);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(2699);
    expect(fetchImpl).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(invocationTimes).toEqual([0, 300, 1200, 3900]);
    expect(result.ok).toBe(true);
  });

  it('does not retry POST requests by default', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('Network failed')));

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const result = await client.post('/plans', {
      body: { id: 1 },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.kind).toBe('network');
  });

  it('deduplicates concurrent GET requests with singleFlight', async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(
              new Response(JSON.stringify({ value: 42 }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
              }),
            );
          }, 10);
        }),
    );

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const pending = Promise.all(
      Array.from({ length: 5 }, () => client.get<{ value: number }>('/floors')),
    );

    await vi.advanceTimersByTimeAsync(10);
    const results = await pending;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('respects Retry-After when present', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'RATE_LIMITED' }), {
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '2',
          },
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const pending = client.get<{ ok: boolean }>('/rate-limited');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it('sanitizes sensitive query params in request logs and telemetry', async () => {
    const telemetry = vi.fn();
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.searchParams.get('token')).toBe('abc');
      expect(url.searchParams.get('secret')).toBe('def');
      expect(url.searchParams.get('jwt')).toBe('ghi');
      expect(url.searchParams.get('api_key')).toBe('jkl');

      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      );
    });

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    client.events.on('http:done', telemetry);

    const result = await client.get<{ ok: boolean }>('/inspect', {
      query: {
        api_key: 'jkl',
        jwt: 'ghi',
        safe: 'ok',
        secret: 'def',
        token: 'abc',
      },
    });

    expect(result.ok).toBe(true);

    const loggedRequest = client.getRecentRequests()[0];
    expect(loggedRequest?.url).toContain('token=*****');
    expect(loggedRequest?.url).toContain('secret=*****');
    expect(loggedRequest?.url).toContain('jwt=*****');
    expect(loggedRequest?.url).toContain('api_key=*****');
    expect(loggedRequest?.url).toContain('safe=ok');

    expect(telemetry).toHaveBeenCalledTimes(1);
    expect(telemetry.mock.calls[0]?.[0].url).toContain('token=*****');
    expect(telemetry.mock.calls[0]?.[0].url).toContain('safe=ok');
  });

  it('keeps only the latest 50 request log entries', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }),
      ),
    );

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    for (let index = 0; index < 51; index += 1) {
      const result = await client.get<{ ok: boolean }>(`/items/${index}`, {
        disableSingleFlight: true,
      });

      expect(result.ok).toBe(true);
    }

    const logs = client.getRecentRequests();
    expect(logs).toHaveLength(50);
    expect(logs[0]?.url).toContain('/items/1');
    expect(logs[49]?.url).toContain('/items/50');
  });

  it('refreshes auth once for concurrent 401 responses', async () => {
    let token = 'expired-token';
    const refreshToken = vi.fn(async () => {
      token = 'fresh-token';
      return true;
    });
    const onAuthError = vi.fn();
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const headers = new Headers(init?.headers);
      const auth = headers.get('Authorization');

      if (auth === 'Bearer fresh-token') {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, path: url.pathname }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }),
        );
      }

      return Promise.resolve(
        new Response(JSON.stringify({ code: 'EXPIRED' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 401,
        }),
      );
    });

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
      getToken: () => token,
      onAuthError,
      onRefreshToken: refreshToken,
    });

    const results = await Promise.all(
      ['/a', '/b', '/c', '/d', '/e'].map((path) =>
        client.get<{ ok: boolean; path: string }>(path, {
          disableSingleFlight: true,
        }),
      ),
    );

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(onAuthError).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(10);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('rejects oversized text responses before reading body', async () => {
    const response = new Response('x', {
      headers: {
        'Content-Length': String(31 * 1024 * 1024),
        'Content-Type': 'text/plain',
      },
      status: 200,
    });
    const textSpy = vi.spyOn(response, 'text');
    textSpy.mockResolvedValue('x');

    const fetchImpl = vi.fn(() => Promise.resolve(response));

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
    });

    const result = await client.get<string>('/big-text');

    expect(result.ok).toBe(false);

    if (result.ok) {
      return;
    }

    expect(result.error.kind).toBe('parse');
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('attaches request metadata headers and emits telemetry events', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': String(new Headers(init?.headers).get('X-Request-Id')),
          },
          status: 200,
        }),
      ),
    );

    const client = createHttpClient({
      baseUrl: 'https://api.example.com',
      fetchImpl,
      getToken: () => 'secret-token',
    });

    const telemetry = vi.fn();
    client.events.on('http:done', telemetry);

    const result = await client.put<{ ok: boolean }, { level: string }>('/floors/1', {
      body: { level: 'L1' },
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    expect(headers.get('X-Request-Id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(headers.get('X-Client-Version')).toBeTruthy();
    expect(client.getRecentRequests()).toHaveLength(1);
    expect(telemetry).toHaveBeenCalledTimes(1);
  });
});
