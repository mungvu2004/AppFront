/// <reference types="vite/client" />

/**
 * Getting the measurements out, without ever being the reason something broke.
 *
 * This module has one job and one rule. The job: gather the events
 * `./events.ts` allows, hold them until there are twenty or until ten seconds
 * have passed, and post them — with a `sendBeacon` when the tab is going away
 * and there is no time left for a normal request. The rule:
 *
 * **Nothing here may fail the thing it is measuring.**
 *
 * That rule is not a wish, it is the shape of the code. Every public method
 * catches its own errors; a malformed event is dropped, not thrown; a transport
 * that rejects, throws synchronously, or returns something that is not a promise
 * is handled by the same path; a scheduler that will not schedule leaves the
 * queue intact for the next flush. The only observable consequence of telemetry
 * failing is that {@link TelemetrySenderStats} counts the loss.
 *
 * ## The single flag
 *
 * `VITE_TELEMETRY_ENABLED` — see {@link TELEMETRY_ENABLED_FLAG} — is the whole
 * switch. It is read as a static `import.meta.env` property so Vite substitutes
 * it at build time and a build with the flag off carries no live sender at all.
 * When it is off, {@link createTelemetrySender} returns an object whose methods
 * do nothing: no queue, no timer, no transport, not one byte. And it is
 * **fail-closed** — only the exact string `'true'` (or a boolean `true`) turns
 * measurement on, so a missing, misspelt or unreadable environment means off.
 *
 * ## Why batches are dropped rather than retried
 *
 * A failed batch is counted and discarded. A telemetry client that retried would
 * queue more work exactly when the network is already failing — competing with
 * the product's own requests during the outage it is trying to report, and
 * arriving as a thundering herd when the server comes back. What the loss must
 * not do is go unnoticed: the count of lost events rides along in the next
 * batch's {@link TelemetryBatch.droppedCount}, so a backend reading a session
 * knows its sample is incomplete instead of quietly averaging over a hole.
 *
 * {@link MAX_IN_FLIGHT_BATCHES} is the same argument applied to bursts — beyond
 * four unfinished posts the sender stops opening connections and counts the
 * drop, because a thousand events in a tick is a bug in a caller and must not
 * become a thousand requests from a browser.
 *
 * ## Why the close path is separate
 *
 * `fetch` started during `pagehide` is usually killed with the document.
 * `navigator.sendBeacon` is the one call a browser promises to finish, so
 * {@link TelemetryTransport.sendOnClose} exists as its own method — synchronous,
 * boolean, no promise to await. If the browser refuses the beacon (it is over
 * its 64 KB budget, or unimplemented) the sender falls back to the keepalive
 * `fetch` of the normal path, which is worth trying and not worth waiting for.
 */

import { ERROR_REPORTED_EVENT, type ErrorTelemetryDetail } from '@/lib/errors';
import { getPlatformBeacon, getPlatformFetch, type PlatformBeacon } from '@/lib/http';

import {
  TELEMETRY_SCHEMA_VERSION,
  parseTelemetryEvent,
  toScreenErrorEvent,
  type TelemetryEvent,
  type TelemetryEventInput,
} from './events';

/* -------------------------------------------------------------------------- */
/* The flag.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The one switch, by name.
 *
 * Exported for documentation and tests; the sender reads the property
 * statically rather than through this string, because only a static
 * `import.meta.env.VITE_…` is replaced at build time.
 */
export const TELEMETRY_ENABLED_FLAG = 'VITE_TELEMETRY_ENABLED';

/** Reading the environment must not be a way to crash at import time. */
function readTelemetryFlag(): unknown {
  try {
    return import.meta.env.VITE_TELEMETRY_ENABLED;
  } catch {
    // No `import.meta.env` at all — a bare Node context, say. Off is correct.
    return undefined;
  }
}

/**
 * Is measurement on?
 *
 * Fail-closed: exactly `true` or `'true'`. Every other value — `'false'`,
 * `'1'`, `'yes'`, a typo, or nothing at all — means off, because the failure
 * mode of guessing wrong is collecting data nobody agreed to.
 */
export function resolveTelemetryEnabled(value: unknown = readTelemetryFlag()): boolean {
  return value === true || value === 'true';
}

/* -------------------------------------------------------------------------- */
/* What goes on the wire.                                                      */
/* -------------------------------------------------------------------------- */

/** How many events one batch carries. */
export const MAX_BATCH_EVENTS = 20;

/** How long an event may wait for company before it goes on its own. */
export const FLUSH_INTERVAL_MS = 10_000;

/** How many posts may be unfinished at once before batches are dropped. */
export const MAX_IN_FLIGHT_BATCHES = 4;

/** Why a batch was sent. Useful for reading a session backwards. */
export type TelemetryFlushReason = 'size' | 'interval' | 'manual' | 'close';

/** One event, with the two facts the sender adds: when, and in what order. */
export interface TelemetryEnvelope {
  /** Position in this session, from zero. Gaps mean events were lost. */
  readonly sequence: number;
  /** Milliseconds since the epoch, from the injected clock. */
  readonly atMs: number;
  readonly event: TelemetryEvent;
}

/** What one request carries. */
export interface TelemetryBatch {
  readonly schemaVersion: number;
  /** An opaque per-session code. Never a user id; see {@link CreateTelemetrySenderOptions.sessionId}. */
  readonly sessionId: string;
  readonly sentAtMs: number;
  readonly reason: TelemetryFlushReason;
  readonly events: readonly TelemetryEnvelope[];
  /**
   * Events accepted but never delivered before this batch.
   *
   * Reported rather than hidden: a hole in a sample that nobody knows about is
   * worse than a hole that is labelled.
   */
  readonly droppedCount: number;
}

/** The batch as JSON. Separate from the transport so a test can read it. */
export function serialiseBatch(batch: TelemetryBatch): string {
  return JSON.stringify(batch);
}

/* -------------------------------------------------------------------------- */
/* The transport port.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Where batches go.
 *
 * Two methods because the page-close path is genuinely a different call, not a
 * flag on the same one: it must be synchronous, it may not await, and its answer
 * is whether the browser took custody of the bytes.
 */
export interface TelemetryTransport {
  /** The normal path. May reject or throw; the sender handles both. */
  send(batch: TelemetryBatch): Promise<void> | void;
  /** The unload path. Returns whether the browser accepted the payload. */
  sendOnClose(batch: TelemetryBatch): boolean;
}

export interface CreateBeaconTransportOptions {
  readonly url: string;
  /** Defaults to `navigator.sendBeacon`, bound. Injected in tests. */
  readonly beacon?: ((url: string, body: BodyInit) => boolean) | undefined;
  /** Defaults to the global `fetch`. Injected in tests. */
  readonly fetchImpl?: typeof fetch | undefined;
}

const JSON_CONTENT_TYPE = 'application/json';

/* Bound, and null where the browser has none — see `src/lib/http/platform`. */
const resolveBeacon = (): PlatformBeacon | null => getPlatformBeacon();

/** A payload the beacon can label as JSON, or a plain string where it cannot. */
function toBeaconBody(payload: string): BodyInit {
  try {
    return typeof Blob === 'function' ? new Blob([payload], { type: JSON_CONTENT_TYPE }) : payload;
  } catch {
    // A Blob constructor that refuses is not a reason to lose the batch.
    return payload;
  }
}

/**
 * The one adapter: `sendBeacon` on the way out, keepalive `fetch` otherwise.
 *
 * `keepalive` on the normal path too, so a batch begun a moment before a
 * navigation still has a chance of arriving.
 */
export function createBeaconTransport(options: CreateBeaconTransportOptions): TelemetryTransport {
  const { url } = options;

  return {
    send: async (batch) => {
      const fetchImpl = options.fetchImpl ?? getPlatformFetch();
      if (typeof fetchImpl !== 'function') {
        throw new Error('telemetry: no fetch available');
      }

      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': JSON_CONTENT_TYPE },
        body: serialiseBatch(batch),
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`telemetry: transport refused with ${String(response.status)}`);
      }
    },
    sendOnClose: (batch) => {
      const beacon = options.beacon ?? resolveBeacon();
      if (beacon === null) {
        return false;
      }

      try {
        return beacon(url, toBeaconBody(serialiseBatch(batch)));
      } catch {
        // An unimplemented or over-budget beacon is a `false`, not a crash.
        return false;
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* The scheduler port.                                                         */
/* -------------------------------------------------------------------------- */

/** Undo a scheduled flush. */
export type TelemetryCancel = () => void;

/**
 * How the ten-second flush is scheduled.
 *
 * A port that hands back its own canceller rather than a handle, so a test can
 * substitute one in three lines and no timer-handle type escapes this module.
 */
export interface TelemetryScheduler {
  schedule(handler: () => void, delayMs: number): TelemetryCancel;
}

const defaultScheduler: TelemetryScheduler = {
  schedule: (handler, delayMs) => {
    const handle = setTimeout(handler, delayMs);

    return () => {
      clearTimeout(handle);
    };
  },
};

/* -------------------------------------------------------------------------- */
/* The sender.                                                                 */
/* -------------------------------------------------------------------------- */

/** What has happened to this session's measurements. */
export interface TelemetrySenderStats {
  /** Events that matched the catalogue. */
  readonly accepted: number;
  /** Events the catalogue refused. A rising number is a caller bug. */
  readonly rejected: number;
  /** Accepted events that will never arrive. */
  readonly droppedEvents: number;
  readonly batchesSent: number;
  readonly batchesFailed: number;
  readonly queued: number;
  readonly inFlight: number;
}

export interface TelemetrySender {
  /** Whether the flag is on. `false` means every method below does nothing. */
  readonly enabled: boolean;
  /** Record an event. Never throws, whatever is passed. */
  track(event: TelemetryEventInput): void;
  /** Send what is queued now, by the normal path. */
  flush(): void;
  /** Send what is queued now, by the beacon path. Safe to call repeatedly. */
  flushOnClose(): void;
  /** Final flush, then stop: no timer, and later events are ignored. */
  stop(): void;
  stats(): TelemetrySenderStats;
}

export interface CreateTelemetrySenderOptions {
  readonly transport: TelemetryTransport;
  /**
   * An opaque code for this session — a uuid is the expected shape.
   *
   * Not a user id, not an account id, not an email. It must satisfy the code
   * pattern of `./events.ts`; anything else is replaced by
   * {@link FALLBACK_SESSION_ID} rather than sent, because a session id is the
   * one field a careless caller could turn into an identifier.
   */
  readonly sessionId: string;
  /**
   * Overrides the flag. Same switch, exposed so tests do not need an
   * environment; production callers leave it out.
   */
  readonly enabled?: boolean | undefined;
  readonly batchSize?: number | undefined;
  readonly flushIntervalMs?: number | undefined;
  readonly now?: (() => number) | undefined;
  readonly scheduler?: TelemetryScheduler | undefined;
}

/** What an unusable session id becomes. */
export const FALLBACK_SESSION_ID = 'unknown-session';

/** The session id pattern, kept identical to a `./events.ts` code. */
const SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,47}$/;

function resolveSessionId(sessionId: string): string {
  return SESSION_ID_PATTERN.test(sessionId) ? sessionId : FALLBACK_SESSION_ID;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown } | null | undefined)?.then === 'function';
}

/** The sender a disabled flag produces: the same shape, doing nothing. */
function createDisabledSender(): TelemetrySender {
  const emptyStats: TelemetrySenderStats = {
    accepted: 0,
    rejected: 0,
    droppedEvents: 0,
    batchesSent: 0,
    batchesFailed: 0,
    queued: 0,
    inFlight: 0,
  };

  return {
    enabled: false,
    track: () => undefined,
    flush: () => undefined,
    flushOnClose: () => undefined,
    stop: () => undefined,
    stats: () => emptyStats,
  };
}

/**
 * Build the sender.
 *
 * @example
 * const telemetry = createTelemetrySender({
 *   transport: createBeaconTransport({ url: '/api/telemetry' }),
 *   sessionId: createUuid(),
 * });
 * const unbind = bindTelemetryLifecycle(telemetry);
 * telemetry.track({ name: 'wall.edit', operation: 'move', latencyMs: 42, wallCount: 48, undo: false });
 */
export function createTelemetrySender(options: CreateTelemetrySenderOptions): TelemetrySender {
  const enabled = options.enabled ?? resolveTelemetryEnabled();
  if (!enabled) {
    return createDisabledSender();
  }

  const { transport } = options;
  const sessionId = resolveSessionId(options.sessionId);
  const batchSize = Math.max(1, Math.trunc(options.batchSize ?? MAX_BATCH_EVENTS));
  const flushIntervalMs = Math.max(0, Math.trunc(options.flushIntervalMs ?? FLUSH_INTERVAL_MS));
  const scheduler = options.scheduler ?? defaultScheduler;
  const clock = options.now ?? Date.now;

  const queue: TelemetryEnvelope[] = [];
  let pendingCancel: TelemetryCancel | null = null;
  let sequence = 0;
  let stopped = false;
  let inFlight = 0;
  let unreportedDrops = 0;
  let accepted = 0;
  let rejected = 0;
  let droppedEvents = 0;
  let batchesSent = 0;
  let batchesFailed = 0;

  /** A clock that throws is a clock we can do without. */
  const readClock = (): number => {
    try {
      return clock();
    } catch {
      return 0;
    }
  };

  const clearTimer = (): void => {
    if (pendingCancel === null) {
      return;
    }

    const cancel = pendingCancel;
    pendingCancel = null;
    try {
      cancel();
    } catch {
      // A scheduler that cannot cancel costs one spurious flush, nothing more.
    }
  };

  const scheduleFlush = (): void => {
    if (pendingCancel !== null) {
      return;
    }

    try {
      pendingCancel = scheduler.schedule(() => {
        pendingCancel = null;
        flushQueue('interval');
      }, flushIntervalMs);
    } catch {
      // No timer: the events wait for the next size threshold or close.
      pendingCancel = null;
    }
  };

  const buildBatch = (events: readonly TelemetryEnvelope[], reason: TelemetryFlushReason): TelemetryBatch => {
    const droppedCount = unreportedDrops;
    unreportedDrops = 0;

    return {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      sessionId,
      sentAtMs: readClock(),
      reason,
      events,
      droppedCount,
    };
  };

  /**
   * A batch that will not arrive.
   *
   * Its own `droppedCount` goes back on the pile: that number was carried by
   * this batch and dies with it, so the next batch has to carry it instead or
   * the loss disappears from the record.
   */
  const recordLoss = (batch: TelemetryBatch): void => {
    droppedEvents += batch.events.length;
    unreportedDrops += batch.events.length + batch.droppedCount;
  };

  const settle = (batch: TelemetryBatch, delivered: boolean): void => {
    inFlight = Math.max(0, inFlight - 1);
    if (delivered) {
      batchesSent += 1;

      return;
    }

    batchesFailed += 1;
    recordLoss(batch);
  };

  const sendViaBeacon = (batch: TelemetryBatch): boolean => {
    try {
      return transport.sendOnClose(batch);
    } catch {
      // A throwing transport is a refusal; the keepalive path is tried next.
      return false;
    }
  };

  const dispatch = (batch: TelemetryBatch): void => {
    if (batch.reason === 'close' && sendViaBeacon(batch)) {
      batchesSent += 1;

      return;
    }

    if (inFlight >= MAX_IN_FLIGHT_BATCHES) {
      recordLoss(batch);

      return;
    }

    inFlight += 1;
    try {
      const result = transport.send(batch);
      if (isPromiseLike(result)) {
        // Both handlers given, so a rejection can never reach the page as an
        // unhandled promise — which would be telemetry breaking the main flow.
        result.then(
          () => {
            settle(batch, true);
          },
          () => {
            settle(batch, false);
          },
        );

        return;
      }

      settle(batch, true);
    } catch {
      settle(batch, false);
    }
  };

  function flushQueue(reason: TelemetryFlushReason): void {
    clearTimer();

    while (queue.length > 0) {
      dispatch(buildBatch(queue.splice(0, batchSize), reason));
    }
  }

  return {
    enabled: true,
    track: (event) => {
      if (stopped) {
        return;
      }

      try {
        const parsed = parseTelemetryEvent(event);
        if (parsed === null) {
          rejected += 1;

          return;
        }

        queue.push({ sequence, atMs: readClock(), event: parsed });
        sequence += 1;
        accepted += 1;

        if (queue.length >= batchSize) {
          flushQueue('size');

          return;
        }

        scheduleFlush();
      } catch {
        // Whatever went wrong, the caller was mid-edit. It hears nothing.
        rejected += 1;
      }
    },
    flush: () => {
      if (stopped) {
        return;
      }

      try {
        flushQueue('manual');
      } catch {
        // Unreachable in practice: dispatch already swallows its own failures.
      }
    },
    flushOnClose: () => {
      if (stopped) {
        return;
      }

      try {
        flushQueue('close');
      } catch {
        // As above. The tab is closing; there is nobody left to tell.
      }
    },
    stop: () => {
      if (stopped) {
        return;
      }

      try {
        flushQueue('close');
      } catch {
        // As above.
      }
      clearTimer();
      stopped = true;
    },
    stats: () => ({
      accepted,
      rejected,
      droppedEvents,
      batchesSent,
      batchesFailed,
      queued: queue.length,
      inFlight,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Wiring it to the page.                                                      */
/* -------------------------------------------------------------------------- */

/** Whatever the flush hangs off: the real `window`, or a two-method fake. */
export interface TelemetryLifecycleHost {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

/** The same, plus the one property that says whether the tab is still shown. */
export interface TelemetryVisibilityHost extends TelemetryLifecycleHost {
  readonly visibilityState: DocumentVisibilityState;
}

export interface BindTelemetryLifecycleOptions {
  readonly windowObject?: TelemetryLifecycleHost | undefined;
  readonly documentObject?: TelemetryVisibilityHost | undefined;
}

const resolveWindow = (): Window | null => (typeof window === 'undefined' ? null : window);

const resolveDocument = (): Document | null => (typeof document === 'undefined' ? null : document);

/**
 * Flush whenever the page might be about to go.
 *
 * Both events, on purpose. `pagehide` is the reliable one on desktop;
 * `visibilitychange` to `hidden` is the only one a mobile browser guarantees
 * before it freezes or discards a backgrounded tab. Neither stops the sender —
 * a hidden tab is very often a tab that comes back — so this is
 * {@link TelemetrySender.flushOnClose} rather than {@link TelemetrySender.stop}.
 *
 * `beforeunload` is deliberately absent: it does not fire on mobile, and adding
 * a listener for it can disable the back/forward cache for the whole page, which
 * would make the product measurably slower in order to measure it.
 */
export function bindTelemetryLifecycle(
  sender: TelemetrySender,
  options: BindTelemetryLifecycleOptions = {},
): () => void {
  if (!sender.enabled) {
    return () => undefined;
  }

  const windowObject = options.windowObject ?? resolveWindow();
  const documentObject = options.documentObject ?? resolveDocument();

  const handlePageHide = (): void => {
    sender.flushOnClose();
  };

  const handleVisibilityChange = (): void => {
    if (documentObject?.visibilityState === 'hidden') {
      sender.flushOnClose();
    }
  };

  windowObject?.addEventListener('pagehide', handlePageHide);
  documentObject?.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    windowObject?.removeEventListener('pagehide', handlePageHide);
    documentObject?.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export interface BindErrorReportsOptions {
  /** Where `reportError` dispatches. Defaults to `window`. */
  readonly eventTarget?: EventTarget | undefined;
  /**
   * Which screen is on, as a code — a value or a callback for a live route.
   *
   * A route *path* is not a code: it has slashes and may carry an id. Pass a
   * slug. Anything the catalogue refuses drops the measurement rather than
   * sending the string.
   */
  readonly screenCode?: string | (() => string) | undefined;
}

/** What a screen is called when nobody said. */
export const UNKNOWN_SCREEN_CODE = 'unknown';

/**
 * Turn the errors people actually see into the fourth indicator.
 *
 * `src/lib/errors` already dispatches a `telemetry:error` event for every
 * reported failure, so the error rate can be measured without a single line
 * changing in a component or a screen. Only four codes cross over — see
 * {@link toScreenErrorEvent} — and the sanitised context that ships with the
 * report is left where it is.
 */
export function bindErrorReportsToTelemetry(
  sender: TelemetrySender,
  options: BindErrorReportsOptions = {},
): () => void {
  if (!sender.enabled) {
    return () => undefined;
  }

  const target = options.eventTarget ?? resolveWindow();
  if (target === null) {
    return () => undefined;
  }

  const readScreenCode = (): string => {
    const { screenCode } = options;
    if (typeof screenCode === 'function') {
      try {
        return screenCode();
      } catch {
        // A route reader that throws must not take the error report with it.
        return UNKNOWN_SCREEN_CODE;
      }
    }

    return screenCode ?? UNKNOWN_SCREEN_CODE;
  };

  const handleReport = (event: Event): void => {
    try {
      const { detail } = event as Event & { detail?: ErrorTelemetryDetail };
      if (detail === undefined) {
        return;
      }

      const screenError = toScreenErrorEvent(detail, readScreenCode());
      if (screenError !== null) {
        sender.track(screenError);
      }
    } catch {
      // An error while reporting an error is exactly where a loop starts.
    }
  };

  target.addEventListener(ERROR_REPORTED_EVENT, handleReport);

  return () => {
    target.removeEventListener(ERROR_REPORTED_EVENT, handleReport);
  };
}
