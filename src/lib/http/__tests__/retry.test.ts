import { describe, expect, it, vi } from 'vitest';

import { MAX_RETRY_AFTER_DELAY_MS, computeRetryDelayMs, parseRetryAfterMs, RETRY_DELAYS_MS, shouldRetryRequest } from '../retry';

describe('http/retry.ts', () => {
  it('computes exponential backoff with jitter', () => {
    const random = vi.fn(() => 0);

    expect(computeRetryDelayMs(0, null, random)).toBe(RETRY_DELAYS_MS[0]);
    expect(computeRetryDelayMs(1, null, random)).toBe(RETRY_DELAYS_MS[1]);
    expect(computeRetryDelayMs(2, null, random)).toBe(RETRY_DELAYS_MS[2]);
  });

  it('clamps Retry-After to the configured upper bound', () => {
    expect(parseRetryAfterMs('999999')).toBe(MAX_RETRY_AFTER_DELAY_MS);
    expect(parseRetryAfterMs(new Date('2030-01-01T00:00:00Z').toUTCString(), 0)).toBe(
      MAX_RETRY_AFTER_DELAY_MS,
    );
  });

  it('retries only GET by default and idempotent writes when key exists', () => {
    expect(
      shouldRetryRequest({
        attemptIndex: 0,
        method: 'GET',
        status: 503,
      }),
    ).toBe(true);

    expect(
      shouldRetryRequest({
        attemptIndex: 0,
        method: 'POST',
        status: 503,
      }),
    ).toBe(false);

    expect(
      shouldRetryRequest({
        attemptIndex: 0,
        idempotencyKey: 'abc',
        method: 'POST',
        status: 503,
      }),
    ).toBe(true);
  });
});
