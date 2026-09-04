import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_ERROR_KINDS, reportError, type AppError, type ErrorTelemetryDetail } from '@/lib/errors';

import {
  EXPERIENCE_TARGETS,
  MAX_TELEMETRY_FRAME_RATE,
  TELEMETRY_CODE_PATTERN,
  TELEMETRY_EVENT_NAMES,
  TELEMETRY_SCHEMA_VERSION,
  isTelemetryEventName,
  parseTelemetryEvent,
  summariseExperience,
  toScreenErrorEvent,
  type TelemetryEvent,
  type TelemetryEventInput,
  type TelemetryEventName,
} from '../events';
import {
  FALLBACK_SESSION_ID,
  FLUSH_INTERVAL_MS,
  MAX_BATCH_EVENTS,
  MAX_IN_FLIGHT_BATCHES,
  bindErrorReportsToTelemetry,
  bindTelemetryLifecycle,
  createBeaconTransport,
  createTelemetrySender,
  resolveTelemetryEnabled,
  serialiseBatch,
  type TelemetryBatch,
  type TelemetryScheduler,
  type TelemetrySender,
  type TelemetryTransport,
  type TelemetryVisibilityHost,
} from '../sender';

/* -------------------------------------------------------------------------- */
/* Fixtures. Counts are the standard sample: 48 walls, 21 objects, 34          */
/* dimension chains, 14 rooms, 4 levels.                                       */
/* -------------------------------------------------------------------------- */

const SESSION_ID = '5b7c1e42-9a3d-4f18-8c07-2ad6f1e93b40';
const TELEMETRY_URL = '/api/telemetry';

/** Strings a measurement must never carry. Values, deliberately: see the tests. */
const PRIVATE_FILE_NAME = 'Bản vẽ nhà anh Ba.pdf';
const PRIVATE_PROJECT_LABEL = 'Dự án nhà anh Ba';

const SAMPLE_EVENTS: Readonly<Record<TelemetryEventName, TelemetryEventInput>> = {
  'drawing.upload': {
    name: 'drawing.upload',
    outcome: 'success',
    durationMs: 4_200,
    sizeKb: 8_640,
    pageCount: 4,
  },
  'ai.started': {
    name: 'ai.started',
    levelCount: 4,
    pageCount: 4,
  },
  'ai.finished': {
    name: 'ai.finished',
    outcome: 'success',
    durationMs: 18_400,
    wallCount: 48,
    openingCount: 21,
    dimensionCount: 34,
    roomCount: 14,
    levelCount: 4,
    confidencePercent: 71,
  },
  'wall.edit': {
    name: 'wall.edit',
    operation: 'move',
    latencyMs: 42,
    wallCount: 48,
    undo: false,
  },
  'rules.run': {
    name: 'rules.run',
    ruleSetCode: 'baseline-2026',
    outcome: 'success',
    durationMs: 1_900,
    checkedCount: 48,
    verifiedCount: 12,
    attentionCount: 7,
    violationCount: 5,
  },
  'export.file': {
    name: 'export.file',
    format: 'pdf',
    outcome: 'success',
    durationMs: 6_100,
    sizeKb: 2_480,
    pageCount: 14,
  },
  'screen.error': {
    name: 'screen.error',
    screenCode: 'qc-review',
    errorKind: 'processing',
    severity: 'critical',
    retryable: true,
  },
  'app.first-frame': {
    name: 'app.first-frame',
    screenCode: 'qc-review',
    durationMs: 1_240,
    coldStart: true,
  },
  'scene.build': {
    name: 'scene.build',
    durationMs: 2_150,
    levelCount: 4,
    wallCount: 48,
    roomCount: 14,
    triangleCount: 184_320,
  },
  'scene.frame-rate': {
    name: 'scene.frame-rate',
    averageFps: 52.4,
    durationMs: 96_000,
    triangleCount: 184_320,
  },
  'project.open': {
    name: 'project.open',
    source: 'card',
    status: 'processing',
  },
};

const wallEdit = (latencyMs: number): TelemetryEventInput => ({
  name: 'wall.edit',
  operation: 'move',
  latencyMs,
  wallCount: 48,
  undo: false,
});

/** Every event, already parsed, for the pure summary tests. */
function parsedEvent(name: TelemetryEventName): TelemetryEvent {
  const parsed = parseTelemetryEvent(SAMPLE_EVENTS[name]);
  if (parsed === null) {
    throw new Error(`fixture for ${name} does not match the catalogue`);
  }

  return parsed;
}

/* -------------------------------------------------------------------------- */
/* Doubles.                                                                    */
/* -------------------------------------------------------------------------- */

interface RecordingTransport extends TelemetryTransport {
  readonly sent: TelemetryBatch[];
  readonly closed: TelemetryBatch[];
  settleAll(delivered: boolean): void;
}

interface RecordingTransportOptions {
  /** How `send` answers. `pending` never settles, for the burst test. */
  readonly sendMode?: 'resolve' | 'reject' | 'throw' | 'sync' | 'pending';
  /** What `sendOnClose` answers, or `throw` to prove a throwing beacon is safe. */
  readonly closeMode?: 'accept' | 'refuse' | 'throw';
}

function createRecordingTransport(options: RecordingTransportOptions = {}): RecordingTransport {
  const sendMode = options.sendMode ?? 'resolve';
  const closeMode = options.closeMode ?? 'accept';
  const sent: TelemetryBatch[] = [];
  const closed: TelemetryBatch[] = [];
  const pending: Array<{ resolve: () => void; reject: () => void }> = [];

  return {
    sent,
    closed,
    send: (batch) => {
      sent.push(batch);

      switch (sendMode) {
        case 'reject':
          return Promise.reject(new Error('transport refused'));
        case 'throw':
          throw new Error('transport exploded');
        case 'sync':
          return undefined;
        case 'pending':
          return new Promise<void>((resolve, reject) => {
            pending.push({ resolve, reject: () => { reject(new Error('transport refused')); } });
          });
        default:
          return Promise.resolve();
      }
    },
    sendOnClose: (batch) => {
      closed.push(batch);
      if (closeMode === 'throw') {
        throw new Error('beacon exploded');
      }

      return closeMode === 'accept';
    },
    settleAll: (delivered) => {
      const waiting = pending.splice(0, pending.length);
      waiting.forEach((entry) => {
        if (delivered) {
          entry.resolve();
        } else {
          entry.reject();
        }
      });
    },
  };
}

interface ManualScheduler extends TelemetryScheduler {
  readonly pendingCount: () => number;
  readonly lastDelayMs: () => number | null;
  readonly runDue: () => void;
}

function createManualScheduler(): ManualScheduler {
  const entries: Array<{ handler: () => void; delayMs: number }> = [];
  let lastDelayMs: number | null = null;

  return {
    schedule: (handler, delayMs) => {
      const entry = { handler, delayMs };
      lastDelayMs = delayMs;
      entries.push(entry);

      return () => {
        const index = entries.indexOf(entry);
        if (index >= 0) {
          entries.splice(index, 1);
        }
      };
    },
    pendingCount: () => entries.length,
    lastDelayMs: () => lastDelayMs,
    runDue: () => {
      const due = entries.splice(0, entries.length);
      due.forEach((entry) => {
        entry.handler();
      });
    },
  };
}

interface FakeEventHost extends TelemetryVisibilityHost {
  dispatch(type: string): void;
  listenerCount(type: string): number;
  setVisibility(state: DocumentVisibilityState): void;
}

function createFakeEventHost(): FakeEventHost {
  const listeners = new Map<string, Array<(event: Event) => void>>();
  let visibility: DocumentVisibilityState = 'visible';

  return {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (type, listener) => {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    },
    removeEventListener: (type, listener) => {
      const existing = listeners.get(type) ?? [];
      const index = existing.indexOf(listener);
      if (index >= 0) {
        existing.splice(index, 1);
      }
      listeners.set(type, existing);
    },
    dispatch: (type) => {
      [...(listeners.get(type) ?? [])].forEach((listener) => {
        listener(new Event(type));
      });
    },
    listenerCount: (type) => (listeners.get(type) ?? []).length,
    setVisibility: (state) => {
      visibility = state;
    },
  };
}

/** Let queued promise callbacks run without leaning on timers. */
async function settleMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createSender(
  transport: TelemetryTransport,
  overrides: Partial<Parameters<typeof createTelemetrySender>[0]> = {},
): TelemetrySender {
  return createTelemetrySender({
    transport,
    sessionId: SESSION_ID,
    enabled: true,
    ...overrides,
  });
}

const batchSizes = (batches: readonly TelemetryBatch[]): number[] =>
  batches.map((batch) => batch.events.length);

/* -------------------------------------------------------------------------- */
/* The catalogue.                                                              */
/* -------------------------------------------------------------------------- */

describe('telemetry catalogue', () => {
  it.each([...TELEMETRY_EVENT_NAMES])('accepts the %s event', (name) => {
    const parsed = parseTelemetryEvent(SAMPLE_EVENTS[name]);

    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe(name);
  });

  it('lists every event in the union and nothing else', () => {
    expect(new Set(TELEMETRY_EVENT_NAMES).size).toBe(TELEMETRY_EVENT_NAMES.length);
    expect(Object.keys(SAMPLE_EVENTS).sort()).toEqual([...TELEMETRY_EVENT_NAMES].sort());
    expect(TELEMETRY_EVENT_NAMES.every((name) => isTelemetryEventName(name))).toBe(true);
    expect(isTelemetryEventName('wall.rotate')).toBe(false);
  });

  it('refuses a free-form event', () => {
    expect(parseTelemetryEvent({ name: 'user.clicked-something', label: 'export button' })).toBeNull();
    expect(parseTelemetryEvent({ name: '', durationMs: 1 })).toBeNull();
    expect(parseTelemetryEvent(null)).toBeNull();
    expect(parseTelemetryEvent('wall.edit')).toBeNull();
  });

  it('drops a field the catalogue does not name', () => {
    const parsed = parseTelemetryEvent({
      ...SAMPLE_EVENTS['drawing.upload'],
      fileName: PRIVATE_FILE_NAME,
      operatorEmail: 'quanly@example.com',
    });

    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed ?? {}).sort()).toEqual(
      ['name', 'outcome', 'durationMs', 'sizeKb', 'pageCount'].sort(),
    );
    expect(JSON.stringify(parsed)).not.toContain(PRIVATE_FILE_NAME);
  });

  it('rounds a mean frame rate to a whole number', () => {
    const parsed = parseTelemetryEvent(SAMPLE_EVENTS['scene.frame-rate']);

    expect(parsed).toMatchObject({
      name: 'scene.frame-rate',
      averageFps: 52,
      durationMs: 96_000,
      triangleCount: 184_320,
    });
  });

  it('accepts a session that painted nothing at all', () => {
    const parsed = parseTelemetryEvent({
      ...SAMPLE_EVENTS['scene.frame-rate'],
      averageFps: 0,
    });

    expect(parsed).toMatchObject({ name: 'scene.frame-rate', averageFps: 0 });
  });

  it('refuses a frame rate no renderer produced', () => {
    const beyondTheCounter = { ...SAMPLE_EVENTS['scene.frame-rate'], averageFps: MAX_TELEMETRY_FRAME_RATE + 1 };
    const negative = { ...SAMPLE_EVENTS['scene.frame-rate'], averageFps: -1 };
    const notANumber = { ...SAMPLE_EVENTS['scene.frame-rate'], averageFps: Number.NaN };

    expect(parseTelemetryEvent(beyondTheCounter)).toBeNull();
    expect(parseTelemetryEvent(negative)).toBeNull();
    expect(parseTelemetryEvent(notANumber)).toBeNull();
  });

  it('carries no scene identity alongside the frame rate', () => {
    const parsed = parseTelemetryEvent({
      ...SAMPLE_EVENTS['scene.frame-rate'],
      projectLabel: PRIVATE_PROJECT_LABEL,
      levelId: 'L-GROUND0001',
    });

    expect(Object.keys(parsed ?? {}).sort()).toEqual(
      ['name', 'averageFps', 'durationMs', 'triangleCount'].sort(),
    );
    expect(JSON.stringify(parsed)).not.toContain(PRIVATE_PROJECT_LABEL);
  });

  it('refuses a code that could hold a label', () => {
    const withLabel = { ...SAMPLE_EVENTS['screen.error'], screenCode: PRIVATE_PROJECT_LABEL };
    const withPath = { ...SAMPLE_EVENTS['screen.error'], screenCode: '/projects/4821/qc' };
    const withCapitals = { ...SAMPLE_EVENTS['screen.error'], screenCode: 'QCReview' };
    const tooLong = { ...SAMPLE_EVENTS['screen.error'], screenCode: 'a'.repeat(49) };

    expect(parseTelemetryEvent(withLabel)).toBeNull();
    expect(parseTelemetryEvent(withPath)).toBeNull();
    expect(parseTelemetryEvent(withCapitals)).toBeNull();
    expect(parseTelemetryEvent(tooLong)).toBeNull();
    expect(TELEMETRY_CODE_PATTERN.test('qc-review')).toBe(true);
  });

  it('refuses numbers that are not measurements', () => {
    const cases = [Number.NaN, Number.POSITIVE_INFINITY, -1, 86_400_001];

    cases.forEach((latencyMs) => {
      expect(parseTelemetryEvent(wallEdit(latencyMs))).toBeNull();
    });
  });

  it('rounds a duration to whole milliseconds', () => {
    const parsed = parseTelemetryEvent(wallEdit(41.6));

    expect(parsed?.name === 'wall.edit' ? parsed.latencyMs : null).toBe(42);
  });

  it('names errors from the application taxonomy', () => {
    const known = { ...SAMPLE_EVENTS['screen.error'], errorKind: APP_ERROR_KINDS[0] };
    const invented = { ...SAMPLE_EVENTS['screen.error'], errorKind: 'wall-too-thin' };

    expect(parseTelemetryEvent(known)).not.toBeNull();
    expect(parseTelemetryEvent(invented)).toBeNull();
  });

  it('parses a valid ai.started event', () => {
    const parsed = parseTelemetryEvent(SAMPLE_EVENTS['ai.started']);

    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('ai.started');
  });

  it('drops a field ai.started does not name', () => {
    const parsed = parseTelemetryEvent({
      ...SAMPLE_EVENTS['ai.started'],
      fileName: PRIVATE_FILE_NAME,
    });

    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed ?? {}).sort()).toEqual(['name', 'levelCount', 'pageCount'].sort());
    expect(JSON.stringify(parsed)).not.toContain(PRIVATE_FILE_NAME);
  });

  it('refuses ai.started values that are not measurements', () => {
    expect(parseTelemetryEvent({ ...SAMPLE_EVENTS['ai.started'], levelCount: '4' })).toBeNull();
    expect(parseTelemetryEvent({ ...SAMPLE_EVENTS['ai.started'], pageCount: -1 })).toBeNull();
    expect(parseTelemetryEvent({ ...SAMPLE_EVENTS['ai.started'], levelCount: Number.NaN })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The bridge from src/lib/errors.                                             */
/* -------------------------------------------------------------------------- */

describe('toScreenErrorEvent', () => {
  const appError: AppError = {
    kind: 'processing',
    code: 'PROCESSING',
    messageKey: 'errors.processing.description',
    params: {},
    requestId: 'req-1',
    retryable: true,
    severity: 'nghiêm trọng',
    recovery: 'thử lại',
  };

  const detail: ErrorTelemetryDetail = {
    appError,
    context: { projectLabel: PRIVATE_PROJECT_LABEL, floorIndex: 2 },
    timestamp: '2026-08-17T09:00:00.000Z',
  };

  it('keeps four codes and leaves the context behind', () => {
    const event = toScreenErrorEvent(detail, 'qc-review');

    expect(event).toEqual({
      name: 'screen.error',
      screenCode: 'qc-review',
      errorKind: 'processing',
      severity: 'critical',
      retryable: true,
    });
    expect(JSON.stringify(event)).not.toContain(PRIVATE_PROJECT_LABEL);
  });

  it('gives up rather than send a screen name that is not a code', () => {
    expect(toScreenErrorEvent(detail, PRIVATE_PROJECT_LABEL)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The flag.                                                                   */
/* -------------------------------------------------------------------------- */

describe('the single flag', () => {
  it('is fail-closed', () => {
    expect(resolveTelemetryEnabled(true)).toBe(true);
    expect(resolveTelemetryEnabled('true')).toBe(true);
    expect(resolveTelemetryEnabled('false')).toBe(false);
    expect(resolveTelemetryEnabled('yes')).toBe(false);
    expect(resolveTelemetryEnabled('1')).toBe(false);
    expect(resolveTelemetryEnabled(undefined)).toBe(false);
    expect(resolveTelemetryEnabled(null)).toBe(false);
  });

  it('turns everything off, down to the queue', () => {
    const transport = createRecordingTransport();
    const scheduler = createManualScheduler();
    const sender = createSender(transport, { enabled: false, scheduler });

    Array.from({ length: 50 }, (_unused, index) => index).forEach((index) => {
      sender.track(wallEdit(index));
    });
    sender.flush();
    sender.flushOnClose();
    sender.stop();

    expect(sender.enabled).toBe(false);
    expect(transport.sent).toHaveLength(0);
    expect(transport.closed).toHaveLength(0);
    expect(scheduler.pendingCount()).toBe(0);
    expect(sender.stats()).toEqual({
      accepted: 0,
      rejected: 0,
      droppedEvents: 0,
      batchesSent: 0,
      batchesFailed: 0,
      queued: 0,
      inFlight: 0,
    });
  });

  it('is off in a build that never set it', () => {
    const transport = createRecordingTransport();
    const sender = createTelemetrySender({ transport, sessionId: SESSION_ID });

    sender.track(wallEdit(42));

    expect(sender.enabled).toBe(false);
    expect(transport.sent).toHaveLength(0);
  });

  it('never binds a listener when it is off', () => {
    const host = createFakeEventHost();
    const sender = createSender(createRecordingTransport(), { enabled: false });

    bindTelemetryLifecycle(sender, { windowObject: host, documentObject: host });

    expect(host.listenerCount('pagehide')).toBe(0);
    expect(host.listenerCount('visibilitychange')).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Batching.                                                                   */
/* -------------------------------------------------------------------------- */

describe('batching', () => {
  it('turns 50 events into exactly 3 requests', async () => {
    const transport = createRecordingTransport();
    const scheduler = createManualScheduler();
    const sender = createSender(transport, { scheduler });

    Array.from({ length: 50 }, (_unused, index) => index).forEach((index) => {
      sender.track(wallEdit(index));
    });

    expect(batchSizes(transport.sent)).toEqual([MAX_BATCH_EVENTS, MAX_BATCH_EVENTS]);
    expect(sender.stats().queued).toBe(10);

    sender.flush();
    await settleMicrotasks();

    expect(transport.sent).toHaveLength(3);
    expect(batchSizes(transport.sent)).toEqual([MAX_BATCH_EVENTS, MAX_BATCH_EVENTS, 10]);
    expect(sender.stats()).toMatchObject({
      accepted: 50,
      rejected: 0,
      droppedEvents: 0,
      batchesSent: 3,
      batchesFailed: 0,
      queued: 0,
    });
  });

  it('waits rather than send a lone event straight away', () => {
    const transport = createRecordingTransport();
    const scheduler = createManualScheduler();
    const sender = createSender(transport, { scheduler });

    sender.track(wallEdit(42));

    expect(transport.sent).toHaveLength(0);
    expect(scheduler.pendingCount()).toBe(1);
    expect(scheduler.lastDelayMs()).toBe(FLUSH_INTERVAL_MS);
  });

  it('sends what it has after ten seconds', () => {
    const transport = createRecordingTransport();
    const scheduler = createManualScheduler();
    const sender = createSender(transport, { scheduler });

    sender.track(wallEdit(11));
    sender.track(wallEdit(12));
    scheduler.runDue();

    expect(batchSizes(transport.sent)).toEqual([2]);
    expect(transport.sent[0]?.reason).toBe('interval');
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('sends after ten seconds on the real timer too', () => {
    vi.useFakeTimers();
    try {
      const transport = createRecordingTransport();
      const sender = createSender(transport);

      sender.track(wallEdit(42));
      expect(transport.sent).toHaveLength(0);

      vi.advanceTimersByTime(FLUSH_INTERVAL_MS - 1);
      expect(transport.sent).toHaveLength(0);

      vi.advanceTimersByTime(1);
      expect(batchSizes(transport.sent)).toEqual([1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not leave a timer running once a full batch has gone', () => {
    const transport = createRecordingTransport();
    const scheduler = createManualScheduler();
    const sender = createSender(transport, { scheduler, batchSize: 3 });

    sender.track(wallEdit(1));
    expect(scheduler.pendingCount()).toBe(1);

    sender.track(wallEdit(2));
    sender.track(wallEdit(3));

    expect(batchSizes(transport.sent)).toEqual([3]);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('stamps each batch with the session, the clock and the order', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport, { batchSize: 2, now: () => 1_760_000_000_000 });

    sender.track(wallEdit(1));
    sender.track(wallEdit(2));

    const batch = transport.sent[0];

    expect(batch?.schemaVersion).toBe(TELEMETRY_SCHEMA_VERSION);
    expect(batch?.sessionId).toBe(SESSION_ID);
    expect(batch?.sentAtMs).toBe(1_760_000_000_000);
    expect(batch?.reason).toBe('size');
    expect(batch?.events.map((envelope) => envelope.sequence)).toEqual([0, 1]);
    expect(batch?.events.map((envelope) => envelope.atMs)).toEqual([
      1_760_000_000_000,
      1_760_000_000_000,
    ]);
  });

  it('replaces a session id that could identify somebody', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport, { batchSize: 1, sessionId: 'quanly@example.com' });

    sender.track(wallEdit(1));

    expect(transport.sent[0]?.sessionId).toBe(FALLBACK_SESSION_ID);
  });

  it('refuses an event that is not in the catalogue without losing the rest', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport, { batchSize: 2 });

    sender.track({ name: 'user.rage-click', note: PRIVATE_PROJECT_LABEL } as unknown as TelemetryEventInput);
    sender.track(wallEdit(1));
    sender.track(wallEdit(2));

    expect(sender.stats()).toMatchObject({ accepted: 2, rejected: 1 });
    expect(batchSizes(transport.sent)).toEqual([2]);
    expect(serialiseBatch(transport.sent[0] as TelemetryBatch)).not.toContain(PRIVATE_PROJECT_LABEL);
  });

  it('stops opening connections during a burst, and says how much it lost', async () => {
    const transport = createRecordingTransport({ sendMode: 'pending' });
    const sender = createSender(transport, { batchSize: 1 });

    Array.from({ length: MAX_IN_FLIGHT_BATCHES + 2 }, (_unused, index) => index).forEach((index) => {
      sender.track(wallEdit(index));
    });

    expect(transport.sent).toHaveLength(MAX_IN_FLIGHT_BATCHES);
    expect(sender.stats().droppedEvents).toBe(2);

    transport.settleAll(true);
    await settleMicrotasks();
    sender.track(wallEdit(99));

    expect(transport.sent).toHaveLength(MAX_IN_FLIGHT_BATCHES + 1);
    expect(transport.sent.at(-1)?.droppedCount).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Failure never reaches the caller.                                           */
/* -------------------------------------------------------------------------- */

describe('a failing transport', () => {
  it('does not throw when the request rejects', async () => {
    const transport = createRecordingTransport({ sendMode: 'reject' });
    const sender = createSender(transport, { batchSize: 2 });

    expect(() => {
      sender.track(wallEdit(1));
      sender.track(wallEdit(2));
    }).not.toThrow();

    await settleMicrotasks();

    expect(sender.stats()).toMatchObject({ batchesSent: 0, batchesFailed: 1, droppedEvents: 2 });
  });

  it('does not throw when the request explodes synchronously', () => {
    const transport = createRecordingTransport({ sendMode: 'throw' });
    const sender = createSender(transport, { batchSize: 1 });

    expect(() => {
      sender.track(wallEdit(1));
      sender.flush();
    }).not.toThrow();

    expect(sender.stats()).toMatchObject({ batchesFailed: 1, inFlight: 0 });
  });

  it('keeps working after a failure, and reports the hole in the next batch', async () => {
    const transport = createRecordingTransport({ sendMode: 'reject' });
    const failing = createSender(transport, { batchSize: 2 });

    failing.track(wallEdit(1));
    failing.track(wallEdit(2));
    await settleMicrotasks();

    failing.track(wallEdit(3));
    failing.track(wallEdit(4));
    await settleMicrotasks();

    expect(transport.sent).toHaveLength(2);
    expect(transport.sent[0]?.droppedCount).toBe(0);
    expect(transport.sent[1]?.droppedCount).toBe(2);
    expect(failing.stats().droppedEvents).toBe(4);
  });

  it('does not throw when the beacon explodes on the way out', () => {
    const transport = createRecordingTransport({ closeMode: 'throw' });
    const sender = createSender(transport);

    sender.track(wallEdit(1));

    expect(() => {
      sender.flushOnClose();
    }).not.toThrow();

    // The beacon refused, so the keepalive path took the batch instead.
    expect(transport.closed).toHaveLength(1);
    expect(batchSizes(transport.sent)).toEqual([1]);
  });

  it('does not throw when a clock or a scheduler misbehaves', () => {
    const transport = createRecordingTransport();
    const brokenScheduler: TelemetryScheduler = {
      schedule: () => {
        throw new Error('no timers here');
      },
    };
    const sender = createSender(transport, {
      scheduler: brokenScheduler,
      now: () => {
        throw new Error('no clock here');
      },
    });

    expect(() => {
      sender.track(wallEdit(1));
      sender.flush();
    }).not.toThrow();

    expect(batchSizes(transport.sent)).toEqual([1]);
    expect(transport.sent[0]?.sentAtMs).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Leaving the page.                                                           */
/* -------------------------------------------------------------------------- */

describe('closing the tab', () => {
  it('uses the beacon rather than a request', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport);

    sender.track(wallEdit(1));
    sender.track(wallEdit(2));
    sender.flushOnClose();

    expect(batchSizes(transport.closed)).toEqual([2]);
    expect(transport.closed[0]?.reason).toBe('close');
    expect(transport.sent).toHaveLength(0);
    expect(sender.stats()).toMatchObject({ batchesSent: 1, queued: 0 });
  });

  it('falls back to the keepalive request when the browser refuses the beacon', () => {
    const transport = createRecordingTransport({ closeMode: 'refuse' });
    const sender = createSender(transport);

    sender.track(wallEdit(1));
    sender.flushOnClose();

    expect(batchSizes(transport.closed)).toEqual([1]);
    expect(batchSizes(transport.sent)).toEqual([1]);
  });

  it('flushes on pagehide and on a tab going to the background', () => {
    const transport = createRecordingTransport();
    const host = createFakeEventHost();
    const sender = createSender(transport);
    const unbind = bindTelemetryLifecycle(sender, { windowObject: host, documentObject: host });

    sender.track(wallEdit(1));
    host.setVisibility('visible');
    host.dispatch('visibilitychange');
    expect(transport.closed).toHaveLength(0);

    host.setVisibility('hidden');
    host.dispatch('visibilitychange');
    expect(batchSizes(transport.closed)).toEqual([1]);

    sender.track(wallEdit(2));
    host.dispatch('pagehide');
    expect(batchSizes(transport.closed)).toEqual([1, 1]);

    unbind();
    sender.track(wallEdit(3));
    host.dispatch('pagehide');

    expect(transport.closed).toHaveLength(2);
    expect(host.listenerCount('pagehide')).toBe(0);
    expect(host.listenerCount('visibilitychange')).toBe(0);
  });

  it('ignores events tracked after it has stopped', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport);

    sender.track(wallEdit(1));
    sender.stop();
    sender.track(wallEdit(2));
    sender.flush();

    expect(batchSizes(transport.closed)).toEqual([1]);
    expect(transport.sent).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The beacon transport itself.                                                */
/* -------------------------------------------------------------------------- */

describe('createBeaconTransport', () => {
  const batch: TelemetryBatch = {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    sessionId: SESSION_ID,
    sentAtMs: 1_760_000_000_000,
    reason: 'close',
    events: [{ sequence: 0, atMs: 1_760_000_000_000, event: parsedEvent('wall.edit') }],
    droppedCount: 0,
  };

  /** A `fetch` that records what it was asked to do and answers with a status. */
  function createFetchDouble(status: number): {
    readonly calls: Array<{ url: string; init: RequestInit | undefined }>;
    readonly fetchImpl: typeof fetch;
  } {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];

    return {
      calls,
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), init });

        return { ok: status < 400, status } as unknown as Response;
      },
    };
  }

  it('hands the payload to sendBeacon', () => {
    const calls: Array<{ url: string; body: BodyInit }> = [];
    const transport = createBeaconTransport({
      url: TELEMETRY_URL,
      beacon: (url, body) => {
        calls.push({ url, body });

        return true;
      },
    });

    expect(transport.sendOnClose(batch)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(TELEMETRY_URL);
  });

  it('reports a beacon the browser would not take', () => {
    const transport = createBeaconTransport({ url: TELEMETRY_URL, beacon: () => false });

    expect(transport.sendOnClose(batch)).toBe(false);
  });

  it('posts the batch as keepalive json', async () => {
    const { calls, fetchImpl } = createFetchDouble(202);
    const transport = createBeaconTransport({ url: TELEMETRY_URL, fetchImpl });

    await transport.send(batch);

    expect(calls[0]?.url).toBe(TELEMETRY_URL);
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.keepalive).toBe(true);
    expect(calls[0]?.init?.body).toBe(serialiseBatch(batch));
  });

  it('treats a refusal as a failure the sender can count', async () => {
    const { fetchImpl } = createFetchDouble(503);
    const transport = createBeaconTransport({ url: TELEMETRY_URL, fetchImpl });

    await expect(transport.send(batch)).rejects.toThrow(/503/);
  });

  it('carries no free text at all', () => {
    const payload = serialiseBatch(batch);

    expect(payload).not.toContain(PRIVATE_FILE_NAME);
    expect(payload).not.toContain(PRIVATE_PROJECT_LABEL);
    expect(payload).toContain('wall.edit');
  });
});

/* -------------------------------------------------------------------------- */
/* Errors people actually saw.                                                 */
/* -------------------------------------------------------------------------- */

describe('bindErrorReportsToTelemetry', () => {
  const unbinds: Array<() => void> = [];

  afterEach(() => {
    unbinds.splice(0, unbinds.length).forEach((unbind) => {
      unbind();
    });
  });

  it('records a reported error as a code, without its context', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport, { batchSize: 1 });
    unbinds.push(bindErrorReportsToTelemetry(sender, { screenCode: 'qc-review' }));

    reportError(new Error('drawing could not be read'), {
      projectLabel: PRIVATE_PROJECT_LABEL,
      floorIndex: 2,
    });

    const batch = transport.sent[0];
    const event = batch?.events[0]?.event;

    expect(event?.name).toBe('screen.error');
    expect(event?.name === 'screen.error' ? event.screenCode : null).toBe('qc-review');
    expect(APP_ERROR_KINDS).toContain(event?.name === 'screen.error' ? event.errorKind : null);
    expect(serialiseBatch(batch as TelemetryBatch)).not.toContain(PRIVATE_PROJECT_LABEL);
  });

  it('stops recording once unbound', () => {
    const transport = createRecordingTransport();
    const sender = createSender(transport, { batchSize: 1 });
    const unbind = bindErrorReportsToTelemetry(sender, { screenCode: 'qc-review' });

    unbind();
    reportError(new Error('reported after unbind'), {});

    expect(transport.sent).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The four indicators.                                                        */
/* -------------------------------------------------------------------------- */

describe('summariseExperience', () => {
  const durations = (name: 'app.first-frame' | 'scene.build', values: readonly number[]): TelemetryEvent[] =>
    values.map((durationMs) => {
      const parsed = parseTelemetryEvent({ ...SAMPLE_EVENTS[name], durationMs });
      if (parsed === null) {
        throw new Error('fixture does not match the catalogue');
      }

      return parsed;
    });

  const latencies = (values: readonly number[]): TelemetryEvent[] =>
    values.map((latencyMs) => {
      const parsed = parseTelemetryEvent(wallEdit(latencyMs));
      if (parsed === null) {
        throw new Error('fixture does not match the catalogue');
      }

      return parsed;
    });

  it('reads nothing as unknown rather than as a pass', () => {
    const summary = summariseExperience([]);

    expect(summary.timeToFirstFrame).toEqual({
      sampleCount: 0,
      medianMs: null,
      p95Ms: null,
      worstMs: null,
      targetMs: EXPERIENCE_TARGETS.timeToFirstFrameMs,
      withinTarget: null,
    });
    expect(summary.errorRate).toEqual({
      attemptCount: 0,
      errorCount: 0,
      rate: 0,
      targetRate: EXPERIENCE_TARGETS.errorRate,
      withinTarget: null,
    });
  });

  it('measures the first frame on its slow tail', () => {
    const summary = summariseExperience(durations('app.first-frame', [1_200, 2_400, 9_000]));

    expect(summary.timeToFirstFrame).toMatchObject({
      sampleCount: 3,
      medianMs: 2_400,
      p95Ms: 9_000,
      worstMs: 9_000,
      withinTarget: false,
    });
  });

  it('measures the 3D build against its own target', () => {
    const summary = summariseExperience(durations('scene.build', [800, 1_500]));

    expect(summary.sceneBuild).toMatchObject({
      sampleCount: 2,
      medianMs: 800,
      p95Ms: 1_500,
      targetMs: EXPERIENCE_TARGETS.sceneBuildMs,
      withinTarget: true,
    });
  });

  it('measures edit latency from the wall edits themselves', () => {
    const summary = summariseExperience(latencies([40, 60, 80, 120]));

    expect(summary.editLatency).toMatchObject({
      sampleCount: 4,
      medianMs: 60,
      p95Ms: 120,
      targetMs: EXPERIENCE_TARGETS.editLatencyMs,
      withinTarget: false,
    });
  });

  it('counts an error rate over attempts, ignoring what somebody cancelled', () => {
    const failedUpload = parseTelemetryEvent({
      ...SAMPLE_EVENTS['drawing.upload'],
      outcome: 'failure',
      errorKind: 'upload',
    });
    const cancelledUpload = parseTelemetryEvent({
      ...SAMPLE_EVENTS['drawing.upload'],
      outcome: 'cancelled',
    });

    const summary = summariseExperience([
      parsedEvent('drawing.upload'),
      parsedEvent('ai.finished'),
      parsedEvent('rules.run'),
      parsedEvent('export.file'),
      failedUpload as TelemetryEvent,
      cancelledUpload as TelemetryEvent,
      parsedEvent('screen.error'),
      parsedEvent('wall.edit'),
      parsedEvent('scene.build'),
    ]);

    // Six attempts: four successes, one failure, one screen error. The cancelled
    // upload is in neither number; wall.edit and scene.build report no outcome.
    expect(summary.errorRate).toMatchObject({
      attemptCount: 6,
      errorCount: 2,
      withinTarget: false,
    });
    expect(summary.errorRate.rate).toBeCloseTo(2 / 6, 10);
  });

  it('reads a whole session at once', () => {
    const events = TELEMETRY_EVENT_NAMES.map((name) => parsedEvent(name));
    const summary = summariseExperience(events);

    expect(summary.timeToFirstFrame.sampleCount).toBe(1);
    expect(summary.sceneBuild.sampleCount).toBe(1);
    expect(summary.editLatency.sampleCount).toBe(1);
    expect(summary.errorRate.attemptCount).toBe(5);
    expect(summary.errorRate.errorCount).toBe(1);
  });
});
