import { getRetryDelayMs } from './retrySchedule';

export type AutosaveState = 'dirty' | 'failed' | 'offline' | 'saved' | 'saving';

export interface CreateAutosaveOptions<TChanges> {
  debounceMs?: number;
  getChanges: () => TChanges | undefined;
  isOnline?: () => boolean;
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

const DEFAULT_DEBOUNCE_MS = 800;
const DEFAULT_MAX_WAIT_MS = 5_000;
const OFFLINE_RECHECK_MS = 5_000;

const resolveIsOnline = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine);

/**
 * Silent autosave: waits `debounceMs` after the last change before saving,
 * but never lets continuous changes delay a save past `maxWaitMs`. A failed
 * save retries on the schedule in `retrySchedule.ts` (5s/15s/45s) and only
 * moves to "failed" once that schedule is exhausted, leaving `getChanges`
 * (owned by the caller) still holding the unsaved changes. Calls to `save`
 * never overlap - a save requested while one is in flight runs right after
 * it settles. Knows nothing about the shape of `TChanges`.
 */
export function createAutosave<TChanges>(options: CreateAutosaveOptions<TChanges>): Autosave {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const isOnline = options.isOnline ?? resolveIsOnline;
  const now = options.now ?? Date.now;
  const listeners = new Set<(state: AutosaveState) => void>();

  let state: AutosaveState = 'saved';
  let retryAttempt = 0;
  let lastSavedAt: number | undefined;
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
      lastSavedAt = now();
      setState('saved');
    } catch {
      if (!isOnline()) {
        setState('offline');
        scheduleRetry(OFFLINE_RECHECK_MS);
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
