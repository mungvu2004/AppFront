import type { Progress } from '@/api/schemas';

import type { ChannelClock, ChannelState } from './eventChannel';
import type { ProgressPatchEvent } from './mergeEvents';

export const POLL_INTERVAL_MS = 2_500;

type TimerId = ReturnType<typeof setTimeout>;

export interface PollingFetchInput {
  signal: AbortSignal;
  since?: number;
}

export interface PollingVisibilityTarget {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface CreatePollingChannelOptions<TPatch extends object = Progress> {
  fetchEvents: (input: PollingFetchInput) => Promise<readonly ProgressPatchEvent<TPatch>[]>;
  onEvent: (event: ProgressPatchEvent<TPatch>) => void;
  intervalMs?: number;
  onStateChange?: (state: ChannelState) => void;
  since?: number;
  clock?: ChannelClock;
  visibilityTarget?: PollingVisibilityTarget;
}

export interface PollingChannelHandle {
  close(): void;
}

const defaultClock: ChannelClock = {
  clearTimeout: (id) => clearTimeout(id),
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
};

const getDefaultVisibilityTarget = (): PollingVisibilityTarget | undefined =>
  typeof document === 'undefined' ? undefined : document;

const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

export function createPollingChannel<TPatch extends object = Progress>({
  clock = defaultClock,
  fetchEvents,
  intervalMs = POLL_INTERVAL_MS,
  onEvent,
  onStateChange,
  since,
  visibilityTarget = getDefaultVisibilityTarget(),
}: CreatePollingChannelOptions<TPatch>): PollingChannelHandle {
  let closed = false;
  let cursor = since;
  let currentController: AbortController | null = null;
  let nextTimer: TimerId | null = null;
  let pollIndex = 0;

  function emit(status: ChannelState['status'], nextRetryAt: number | null = null): void {
    onStateChange?.({
      attemptIndex: pollIndex,
      nextRetryAt,
      status,
    });
  }

  function clearNextTimer(): void {
    if (nextTimer === null) return;

    clock.clearTimeout(nextTimer);
    nextTimer = null;
  }

  function isHidden(): boolean {
    return visibilityTarget?.hidden ?? false;
  }

  function scheduleNextPoll(): void {
    clearNextTimer();

    if (closed || isHidden()) {
      return;
    }

    nextTimer = clock.setTimeout(() => {
      nextTimer = null;
      void pollNow();
    }, intervalMs);
  }

  async function pollNow(): Promise<void> {
    if (closed || isHidden() || currentController !== null) {
      return;
    }

    const controller = new AbortController();
    currentController = controller;
    emit('dang-noi');

    try {
      const input: PollingFetchInput = {
        signal: controller.signal,
        ...(cursor !== undefined ? { since: cursor } : {}),
      };
      const events = await fetchEvents(input);

      if (closed || isHidden() || currentController !== controller) {
        return;
      }

      events.forEach((event) => {
        cursor = Math.max(cursor ?? -1, event.sequence);
        onEvent(event);
      });

      pollIndex += 1;
      emit('da-noi');
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error) && currentController === controller) {
        emit('mat-ket-noi', clock.now() + intervalMs);
      }
    } finally {
      if (currentController === controller) {
        currentController = null;
        scheduleNextPoll();
      }
    }
  }

  function handleVisibilityChange(): void {
    if (isHidden()) {
      clearNextTimer();
      currentController?.abort();
      currentController = null;
      return;
    }

    void pollNow();
  }

  visibilityTarget?.addEventListener('visibilitychange', handleVisibilityChange);

  if (!isHidden()) {
    void pollNow();
  }

  return {
    close(): void {
      if (closed) return;

      closed = true;
      clearNextTimer();
      currentController?.abort();
      currentController = null;
      visibilityTarget?.removeEventListener('visibilitychange', handleVisibilityChange);
      emit('da-dong');
    },
  };
}
