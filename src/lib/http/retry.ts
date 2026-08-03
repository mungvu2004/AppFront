import type { HttpMethod } from './types';

export const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export const RETRY_DELAYS_MS = [300, 900, 2700] as const;

export const MAX_RETRY_AFTER_DELAY_MS = 120000;

const isAbortLikeError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === 'AbortError' || error.name === 'TimeoutError';
};

export const isNetworkError = (error: unknown): boolean => {
  if (isAbortLikeError(error)) {
    return false;
  }

  return error instanceof TypeError;
};

export const isRetryableMethod = (method: HttpMethod, idempotencyKey?: string): boolean =>
  method === 'GET' || Boolean(idempotencyKey);

export const parseRetryAfterMs = (
  retryAfterValue: string | null,
  now: number = Date.now(),
  maxDelayMs: number = MAX_RETRY_AFTER_DELAY_MS,
): number | null => {
  if (!retryAfterValue) {
    return null;
  }

  const seconds = Number(retryAfterValue);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(maxDelayMs, Math.round(seconds * 1000));
  }

  const retryAt = Date.parse(retryAfterValue);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.min(maxDelayMs, Math.max(0, retryAt - now));
};

export const computeRetryDelayMs = (
  attemptIndex: number,
  retryAfterValue: string | null,
  random: () => number = Math.random,
): number => {
  const retryAfterMs = parseRetryAfterMs(retryAfterValue);

  if (retryAfterMs !== null) {
    return retryAfterMs;
  }

  const fallbackDelay = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 2700;
  const baseDelay = RETRY_DELAYS_MS[attemptIndex] ?? fallbackDelay;
  const jitterMs = Math.floor(random() * 201);

  return baseDelay + jitterMs;
};

export const shouldRetryRequest = ({
  attemptIndex,
  error,
  idempotencyKey,
  method,
  status,
}: {
  attemptIndex: number;
  error?: unknown;
  idempotencyKey?: string;
  method: HttpMethod;
  status?: number;
}): boolean => {
  if (attemptIndex >= RETRY_DELAYS_MS.length) {
    return false;
  }

  if (!isRetryableMethod(method, idempotencyKey)) {
    return false;
  }

  if (typeof status === 'number') {
    return RETRYABLE_STATUSES.has(status);
  }

  return isNetworkError(error);
};

export const waitForRetry = (delayMs: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (delayMs <= 0) {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    const onAbort = (): void => {
      cleanup();
      reject(signal?.reason);
    };

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    };

    if (signal) {
      if (signal.aborted) {
        cleanup();
        reject(signal.reason);
        return;
      }

      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
