import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpClient } from '@/lib/http/client';
import type { HttpError } from '@/lib/http/types';

import { createQueryClient } from '../queryClient';

/**
 * BUG-570: a 5xx read was retried by two layers — the HTTP client's ladder, then React Query
 * running the whole ladder again. A 503 became 8 requests (~9 s) and a 500 two.
 */
describe('createQueryClient retry rule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Reads `/x` through the real client and the real query client; returns how many requests went out. */
  async function countRequests(fetchImpl: ReturnType<typeof vi.fn>): Promise<number> {
    const http = createHttpClient({ baseUrl: 'https://api.example.com', fetchImpl });
    const client = createQueryClient({ queries: { retryDelay: 0 } });
    const read = client
      .fetchQuery({
        queryFn: async () => {
          const result = await http.get('/x');
          if (!result.ok) throw result.error;
          return result.data;
        },
        queryKey: ['bug-570'],
      })
      .catch(() => undefined);

    await vi.advanceTimersByTimeAsync(60_000);
    await read;

    return fetchImpl.mock.calls.length;
  }

  const answer = (status: number) =>
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: 'INTERNAL', message: 'x' }), {
          headers: { 'Content-Type': 'application/json' },
          status,
        }),
      ),
    );

  it('a 503 is retried by the client ladder alone: 4 requests, not 8', async () => {
    expect(await countRequests(answer(503))).toBe(4);
  });

  it('a 500 is asked once: no layer retries it on its own ("Thử lại" is the person\'s)', async () => {
    expect(await countRequests(answer(500))).toBe(1);
  });

  it('a dropped connection is retried by the client ladder alone: 4 requests, not 8', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    expect(await countRequests(fetchImpl)).toBe(4);
  });

  it('a timeout — which the client never retries — is still asked again once by the query layer', async () => {
    const timeout: HttpError = { kind: 'timeout', raw: null, requestId: 'r', retryable: false };
    const queryFn = vi.fn(() => Promise.reject(timeout));
    const client = createQueryClient({ queries: { retryDelay: 0 } });

    const read = client.fetchQuery({ queryFn, queryKey: ['bug-570-timeout'] }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1_000);
    await read;

    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
