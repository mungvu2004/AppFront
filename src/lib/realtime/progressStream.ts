import type { Progress } from '@/api/schemas';

import {
  createEventChannel,
  type ChannelClock,
  type ChannelEvent,
  type ChannelState,
  type EventChannelHandle,
} from './eventChannel';
import { createPollingChannel, POLL_INTERVAL_MS, type PollingChannelHandle, type PollingFetchInput, type PollingVisibilityTarget } from './pollingChannel';
import { mergeEvents, type ProgressPatchEvent } from './mergeEvents';

export const SSE_RETRY_INTERVAL_MS = 60_000;
export const SSE_FAILURE_LIMIT = 3;

type TimerId = ReturnType<typeof setTimeout>;

export type ProgressStreamSource = 'polling' | 'sse';

export interface ProgressStreamEvent<TPatch extends object = Progress> {
  data: Partial<TPatch>;
  eventId: string;
  sequence: number;
  source: ProgressStreamSource;
  type: 'progress';
}

export interface ProgressStreamState extends ChannelState {
  source: ProgressStreamSource;
}

export interface CreateProgressStreamOptions<TPatch extends object = Progress> {
  fetchEvents: (input: PollingFetchInput) => Promise<readonly ProgressPatchEvent<TPatch>[]>;
  onEvent: (event: ProgressStreamEvent<TPatch>) => void;
  url: string;
  clock?: ChannelClock;
  EventSourceImpl?: typeof EventSource;
  lastEventId?: string;
  onStateChange?: (state: ProgressStreamState) => void;
  random?: () => number;
  since?: number;
  toSseEvent?: (event: ChannelEvent) => ProgressPatchEvent<TPatch>;
  visibilityTarget?: PollingVisibilityTarget;
}

export interface ProgressStreamHandle {
  close(): void;
}

const defaultClock: ChannelClock = {
  clearTimeout: (id) => clearTimeout(id),
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
};

const toDefaultSseEvent = (event: ChannelEvent): ProgressPatchEvent<Progress> => ({
  eventId: event.data.id,
  patch: event.data,
  sequence: event.data.progressPercent,
});

export function createProgressStream<TPatch extends object = Progress>({
  clock = defaultClock,
  EventSourceImpl,
  fetchEvents,
  lastEventId,
  onEvent,
  onStateChange,
  random,
  since,
  toSseEvent = toDefaultSseEvent as (event: ChannelEvent) => ProgressPatchEvent<TPatch>,
  url,
  visibilityTarget,
}: CreateProgressStreamOptions<TPatch>): ProgressStreamHandle {
  let activeToken = 0;
  let appliedEventIds = new Set<string>();
  let closed = false;
  let current: Partial<TPatch> = {};
  let lastAppliedSequence = since ?? -1;
  let pollingHandle: PollingChannelHandle | null = null;
  let retryTimer: TimerId | null = null;
  let source: ProgressStreamSource = 'sse';
  let sseFailures = 0;
  let sseHandle: EventChannelHandle | null = null;

  function clearRetryTimer(): void {
    if (retryTimer === null) return;

    clock.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function emitState(state: ChannelState, stateSource: ProgressStreamSource): void {
    onStateChange?.({
      attemptIndex: state.attemptIndex,
      nextRetryAt: state.nextRetryAt,
      source: stateSource,
      status: state.status,
    });
  }

  function emitMerged(events: readonly ProgressPatchEvent<TPatch>[], eventSource: ProgressStreamSource): void {
    const merged = mergeEvents<TPatch>({
      appliedEventIds,
      current,
      incoming: events,
      lastAppliedSequence,
    });

    appliedEventIds = merged.appliedEventIds;
    current = merged.current;
    lastAppliedSequence = merged.lastAppliedSequence;

    merged.events.forEach((event) => {
      onEvent({
        data: event.snapshot,
        eventId: event.eventId,
        sequence: event.sequence,
        source: eventSource,
        type: 'progress',
      });
    });
  }

  function stopPolling(): void {
    if (pollingHandle === null) return;

    const handle = pollingHandle;
    pollingHandle = null;
    handle.close();
  }

  function stopSse(): void {
    if (sseHandle === null) return;

    const handle = sseHandle;
    sseHandle = null;
    handle.close();
  }

  function scheduleSseRetry(): void {
    clearRetryTimer();

    if (closed) {
      return;
    }

    retryTimer = clock.setTimeout(() => {
      retryTimer = null;
      startSse();
    }, SSE_RETRY_INTERVAL_MS);
  }

  function startPolling(): void {
    if (closed) return;

    activeToken += 1;
    const token = activeToken;
    source = 'polling';
    stopSse();
    clearRetryTimer();

    pollingHandle = createPollingChannel<TPatch>({
      clock,
      fetchEvents,
      intervalMs: POLL_INTERVAL_MS,
      onEvent: (event) => {
        if (closed || activeToken !== token || source !== 'polling') return;

        emitMerged([event], 'polling');
      },
      onStateChange: (state) => {
        if (closed || activeToken !== token || source !== 'polling') return;

        emitState(state, 'polling');
      },
      since: lastAppliedSequence,
      ...(visibilityTarget !== undefined ? { visibilityTarget } : {}),
    });

    scheduleSseRetry();
  }

  function startSse(): void {
    if (closed) return;

    activeToken += 1;
    const token = activeToken;
    source = 'sse';
    sseFailures = 0;
    stopPolling();
    clearRetryTimer();

    sseHandle = createEventChannel({
      clock,
      ...(EventSourceImpl !== undefined ? { EventSourceImpl } : {}),
      ...(lastEventId !== undefined ? { lastEventId } : {}),
      onEvent: (event) => {
        if (closed || activeToken !== token || source !== 'sse') return;

        emitMerged([toSseEvent(event)], 'sse');
      },
      onStateChange: (state) => {
        if (closed || activeToken !== token || source !== 'sse') return;

        emitState(state, 'sse');

        if (state.status === 'da-noi') {
          sseFailures = 0;
          return;
        }

        if (state.status !== 'mat-ket-noi') {
          return;
        }

        sseFailures += 1;

        if (sseFailures >= SSE_FAILURE_LIMIT) {
          startPolling();
        }
      },
      ...(random !== undefined ? { random } : {}),
      url,
    });
  }

  startSse();

  return {
    close(): void {
      if (closed) return;

      closed = true;
      activeToken += 1;
      clearRetryTimer();
      stopPolling();
      stopSse();
    },
  };
}
