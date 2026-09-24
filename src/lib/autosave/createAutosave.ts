// Nhập THẲNG `state.ts`, không qua barrel `@/lib/auth`: barrel xuất lại
// `./refresh`, file duy nhất trong `lib/auth` nhập zod, và `createAutosave` là
// nhập TĨNH của `routes/router.tsx` → `hooks/useAutosave`. Qua barrel thì cả
// `lib/auth` lẫn zod rơi vào chunk vào, +19,2 KiB gzip, vỡ hai cổng kích thước
// gói. `state.ts` chỉ nhập kiểu, và `getSession()` (`session.ts:296`) đúng là
// `getSessionSnapshot()` nên hành vi không đổi.
import { getSessionSnapshot as getSession } from '@/lib/auth/state';
import { isTransientWireError } from '@/lib/errors/wireError';

import { getRetryDelayMs } from './retrySchedule';

export type AutosaveState = 'dirty' | 'failed' | 'offline' | 'saved' | 'saving';

export interface CreateAutosaveOptions<TChanges> {
  debounceMs?: number;
  getChanges: () => TChanges | undefined;
  isOnline?: () => boolean;
  isTransientError?: (error: unknown) => boolean;
  maxWaitMs?: number;
  now?: () => number;
  save: (changes: TChanges) => Promise<void>;
}

export interface Autosave {
  getLastSavedAt: () => number | undefined;
  getState: () => AutosaveState;
  notifyChange: () => void;
  saveNow: () => Promise<void>;
  subscribe: (listener: (state: AutosaveState) => void) => () => void;
}

/**
 * Engine đầy đủ: `Autosave` cộng lỗi cuối cùng.
 *
 * `getLastError` KHÔNG vào `Autosave` vì bản giả của giao diện đó ở
 * `hooks/useSaveIndicator.test.ts:8-38` phải biên dịch nguyên — thêm thành viên
 * bắt buộc vào `Autosave` là làm đỏ một file mà thay đổi này không được chạm.
 */
export interface AutosaveEngine extends Autosave {
  getLastError: () => unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 401 trên dây (`HttpError` `kind: 'auth'`) hoặc sau khi đã đọc thành
 * `AppError` `kind: 'unauthenticated'`. Hai hình khác nhau ở chỗ chỉ `HttpError`
 * có `raw` (`lib/errors/toAppError.ts:120`).
 */
const isUnauthenticatedError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }

  return (
    (error.kind === 'auth' && 'raw' in error) ||
    (error.kind === 'unauthenticated' && typeof error.messageKey === 'string')
  );
};

/**
 * Luật mặc định = luật dây, cộng một ngoại lệ về phiên.
 *
 * Một 401 khi phiên vẫn `authenticated` nghĩa là lần làm mới token vừa hỏng
 * tạm, và lần thử lại sau sẽ đi kèm token mới — thứ đó đáng thử lại. Cũng 401
 * ấy khi phiên đã `anonymous` thì không lần thử nào cứu được: người dùng phải
 * đăng nhập lại, nên dừng ngay và giữ `lastError` cho màn đọc.
 */
const isTransientAutosaveError = (error: unknown): boolean => {
  if (isUnauthenticatedError(error)) {
    return getSession().status === 'authenticated';
  }

  return isTransientWireError(error);
};

const DEFAULT_DEBOUNCE_MS = 800;
const DEFAULT_MAX_WAIT_MS = 5_000;
const OFFLINE_RECHECK_MS = 5_000;

const resolveIsOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine);

/**
 * Silent autosave: waits `debounceMs` after the last change before saving,
 * but never lets continuous changes delay a save past `maxWaitMs`. A failed
 * save retries on the schedule in `retrySchedule.ts` (5s/15s/45s) - but only
 * when `isTransientError` says the failure could go away on its own; a
 * permanent one moves to "failed" at once. Either way it leaves `getChanges`
 * (owned by the caller) still holding the unsaved changes. Calls to `save`
 * never overlap - a save requested while one is in flight runs right after
 * it settles. Knows nothing about the shape of `TChanges`.
 */
export function createAutosave<TChanges>(options: CreateAutosaveOptions<TChanges>): AutosaveEngine {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const isOnline = options.isOnline ?? resolveIsOnline;
  const isTransientError = options.isTransientError ?? isTransientAutosaveError;
  const now = options.now ?? Date.now;
  const listeners = new Set<(state: AutosaveState) => void>();

  let state: AutosaveState = 'saved';
  let retryAttempt = 0;
  let lastSavedAt: number | undefined;
  let lastError: unknown;
  let running = false;
  let queuedRerun = false;
  let chainPromise: Promise<void> = Promise.resolve();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const setState = (next: AutosaveState): void => {
    if (state === next) {
      return;
    }

    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const clearDebounceTimer = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
  };

  const clearMaxWaitTimer = (): void => {
    if (maxWaitTimer !== undefined) {
      clearTimeout(maxWaitTimer);
      maxWaitTimer = undefined;
    }
  };

  const clearRetryTimer = (): void => {
    if (retryTimer !== undefined) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  };

  const scheduleRetry = (delayMs: number): void => {
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void attemptSave();
    }, delayMs);
  };

  const runAttempt = async (): Promise<void> => {
    clearDebounceTimer();
    clearMaxWaitTimer();
    clearRetryTimer();

    const changes = options.getChanges();

    if (changes === undefined) {
      setState('saved');
      return;
    }

    if (!isOnline()) {
      setState('offline');
      scheduleRetry(OFFLINE_RECHECK_MS);
      return;
    }

    setState('saving');

    try {
      await options.save(changes);
      retryAttempt = 0;
      lastError = undefined;
      lastSavedAt = now();
      setState('saved');
    } catch (error) {
      if (!isOnline()) {
        setState('offline');
        scheduleRetry(OFFLINE_RECHECK_MS);
        return;
      }

      lastError = error;

      // Lỗi vĩnh viễn (400, 403, 422…) không khá hơn sau 5 s: thử lại chỉ đốt
      // ba vòng để về đúng chỗ này, muộn hơn một phút.
      if (!isTransientError(error)) {
        setState('failed');
        return;
      }

      const delayMs = getRetryDelayMs(retryAttempt);

      if (delayMs === undefined) {
        setState('failed');
        return;
      }

      retryAttempt += 1;
      setState('dirty');
      scheduleRetry(delayMs);
    }
  };

  function attemptSave(): Promise<void> {
    if (running) {
      queuedRerun = true;
      return chainPromise;
    }

    running = true;
    chainPromise = (async () => {
      await runAttempt();

      while (queuedRerun) {
        queuedRerun = false;
        await runAttempt();
      }
    })().finally(() => {
      running = false;
    });

    return chainPromise;
  }

  const armTimers = (): void => {
    clearDebounceTimer();
    debounceTimer = setTimeout(() => void attemptSave(), debounceMs);

    if (maxWaitTimer === undefined) {
      maxWaitTimer = setTimeout(() => void attemptSave(), maxWaitMs);
    }
  };

  const notifyChange = (): void => {
    if (state === 'saved' || state === 'failed') {
      retryAttempt = 0;
      setState('dirty');
    }

    if (retryTimer === undefined) {
      armTimers();
    }
  };

  const saveNow = (): Promise<void> => {
    clearDebounceTimer();
    clearMaxWaitTimer();
    retryAttempt = 0;

    return attemptSave();
  };

  return {
    getLastError: () => lastError,
    getLastSavedAt: () => lastSavedAt,
    getState: () => state,
    notifyChange,
    saveNow,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
