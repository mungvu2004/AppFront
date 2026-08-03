import type { HttpTimeoutMode } from './types';

export const REQUEST_TIMEOUT_MS: Record<HttpTimeoutMode, number> = {
  default: 15000,
  file: 60000,
  stream: 0,
};

const createAbortDomException = (message: string, name: string): Error => {
  try {
    return new DOMException(message, name);
  } catch {
    const error = new Error(message);
    error.name = name;
    return error;
  }
};

export const createTimeoutError = (timeoutMs: number): Error =>
  createAbortDomException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError');

const createAbortError = (): Error => createAbortDomException('Request was aborted', 'AbortError');

export interface ManagedAbortSignal {
  cleanup: () => void;
  isTimeout: () => boolean;
  signal: AbortSignal;
}

export const resolveTimeoutMs = (
  timeoutMode: HttpTimeoutMode = 'default',
  timeoutMs?: number,
): number => {
  if (typeof timeoutMs === 'number') {
    return timeoutMs;
  }

  return REQUEST_TIMEOUT_MS[timeoutMode];
};

export const createManagedAbortSignal = ({
  externalSignal,
  timeoutMs,
}: {
  externalSignal?: AbortSignal;
  timeoutMs: number;
}): ManagedAbortSignal => {
  const controller = new AbortController();
  let timeoutTriggered = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cleanedUp = false;

  const cleanupCallbacks: Array<() => void> = [];

  const cleanup = (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    cleanupCallbacks.forEach((callback) => callback());
    cleanupCallbacks.length = 0;
  };

  const forwardAbort = (reason: unknown): void => {
    if (controller.signal.aborted) {
      return;
    }

    controller.abort(reason);
    cleanup();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      forwardAbort(externalSignal.reason ?? createAbortError());
    } else {
      const onAbort = (): void => {
        forwardAbort(externalSignal.reason ?? createAbortError());
      };

      externalSignal.addEventListener('abort', onAbort, { once: true });
      cleanupCallbacks.push(() => externalSignal.removeEventListener('abort', onAbort));
    }
  }

  if (!controller.signal.aborted && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      forwardAbort(createTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  return {
    cleanup,
    isTimeout: () => timeoutTriggered,
    signal: controller.signal,
  };
};
