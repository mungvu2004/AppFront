import { describe, expect, it, vi } from 'vitest';

import type {
  ApiResult,
  CompleteDrawingUploadInput,
  DrawingsApi,
  InitDrawingUploadInput,
  Progress,
  SendDrawingChunkInput,
} from '@/api/client';
import type { HttpError } from '@/lib/http';

import { encodeBytesBase64 } from '../chunk';
import {
  createUploadScheduler,
  createUploadTask,
  isTerminalUploadError,
  MAX_CHUNK_ATTEMPTS,
  MAX_PARALLEL_UPLOADS,
  PROGRESS_EMITS_PER_SECOND,
  PROGRESS_MIN_GAP_MS,
  runUploadQueue,
  systemUploadClock,
  type UploadClock,
  type UploadFile,
  type UploadTaskState,
  type UploadTimerHandle,
} from '../uploadTask';

/** A clock a test steps by hand — the deterministic half of the rate assertion. */
interface ManualClock {
  readonly clock: UploadClock;
  readonly now: () => number;
  readonly advance: (durationMs: number) => void;
}

const createManualClock = (): ManualClock => {
  const timers = new Map<number, { at: number; run: () => void }>();
  let now = 0;
  let nextHandle = 1;

  const fireDueUpTo = (target: number): void => {
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at)[0];

      if (due === undefined) {
        return;
      }

      timers.delete(due[0]);
      now = due[1].at;
      due[1].run();
    }
  };

  return {
    advance: (durationMs: number): void => {
      const target = now + durationMs;

      fireDueUpTo(target);
      now = target;
    },
    clock: {
      clearTimeout: (handle: UploadTimerHandle): void => {
        timers.delete(handle as unknown as number);
      },
      now: (): number => now,
      setTimeout: (handler: () => void, delayMs: number): UploadTimerHandle => {
        const handle = nextHandle;

        nextHandle += 1;
        timers.set(handle, { at: now + delayMs, run: handler });

        return handle as unknown as UploadTimerHandle;
      },
    },
    now: (): number => now,
  };
};

/** Let every pending microtask run. Nothing here needs a real timer. */
const settle = async (turns = 400): Promise<void> => {
  for (let turn = 0; turn < turns; turn += 1) {
    await Promise.resolve();
  }
};

/**
 * A file whose bytes are in hand, so the whole upload runs on microtasks.
 *
 * jsdom's `Blob` has no `arrayBuffer`, and its `FileReader` needs a real timer;
 * a fake one keeps the tests free of both.
 */
const fakeFile = (bytes: Uint8Array, name = 'ban-ve.pdf'): UploadFile => {
  const makeBlob = (view: Uint8Array): Blob =>
    ({
      arrayBuffer: async (): Promise<ArrayBuffer> =>
        view.slice().buffer as unknown as ArrayBuffer,
      size: view.length,
      slice: (start = 0, end = view.length): Blob => makeBlob(view.subarray(start, end)),
    }) as unknown as Blob;

  const blob = makeBlob(bytes);

  return {
    name,
    size: bytes.length,
    slice: (start?: number, end?: number): Blob => blob.slice(start, end),
    type: 'application/pdf',
  };
};

const rampBytes = (length: number): Uint8Array =>
  Uint8Array.from({ length }, (_unused, index) => index % 256);

const progressAt = (percent: number, step: string): Progress => ({
  id: 'upload-1',
  progressPercent: percent,
  status: percent >= 100 ? 'completed' : 'running',
  step,
});

const ok = <T>(data: T): ApiResult<T> => ({ data, ok: true });

const httpError = (status: number): HttpError => ({
  kind: 'http',
  raw: { status },
  requestId: `request-${String(status)}`,
  retryable: status >= 500,
  status,
});

const failWith = (status: number): ApiResult<Progress> => ({ error: httpError(status), ok: false });

interface RecordingApi {
  readonly api: DrawingsApi;
  readonly chunkBodies: Array<{ chunk: string; chunkIndex: number }>;
  readonly completed: string[];
  readonly initialised: InitDrawingUploadInput['body'][];
}

interface StubApiOptions {
  readonly complete?: (input: CompleteDrawingUploadInput) => Promise<ApiResult<Progress>>;
  readonly initUpload?: (input: InitDrawingUploadInput) => Promise<ApiResult<Progress>>;
  readonly sendChunk?: (input: SendDrawingChunkInput) => Promise<ApiResult<Progress>>;
}

const createRecordingApi = (options: StubApiOptions = {}): RecordingApi => {
  const chunkBodies: Array<{ chunk: string; chunkIndex: number }> = [];
  const completed: string[] = [];
  const initialised: InitDrawingUploadInput['body'][] = [];

  return {
    api: {
      complete: async (input): Promise<ApiResult<Progress>> => {
        completed.push(input.body.uploadId);

        return options.complete?.(input) ?? ok(progressAt(100, 'hoàn tất'));
      },
      initUpload: async (input): Promise<ApiResult<Progress>> => {
        initialised.push(input.body);

        return options.initUpload?.(input) ?? ok(progressAt(0, 'khởi tạo'));
      },
      progress: async (): Promise<ApiResult<Progress>> => ok(progressAt(50, 'đang xử lý')),
      sendChunk: async (input): Promise<ApiResult<Progress>> => {
        chunkBodies.push({ chunk: input.body.chunk, chunkIndex: input.body.chunkIndex });

        return options.sendChunk?.(input) ?? ok(progressAt(50, 'đang tải'));
      },
    },
    chunkBodies,
    completed,
    initialised,
  };
};

/** Run a task to completion against a manual clock, stepping it as needed. */
const runToEnd = async (
  start: () => Promise<UploadTaskState>,
  manual: ManualClock,
): Promise<UploadTaskState> => {
  const running = start();
  let done = false;

  void running.then(() => {
    done = true;
  });

  for (let step = 0; step < 200 && !done; step += 1) {
    await settle(20);
    manual.advance(PROGRESS_MIN_GAP_MS);
  }

  return running;
};

describe('the numbers this module owns', () => {
  it('are written down here and nowhere else', () => {
    expect(MAX_PARALLEL_UPLOADS).toBe(3);
    expect(MAX_CHUNK_ATTEMPTS).toBe(3);
    expect(PROGRESS_EMITS_PER_SECOND).toBe(4);
    expect(PROGRESS_MIN_GAP_MS).toBe(250);
  });
});

describe('isTerminalUploadError', () => {
  it('calls 413 and 422 terminal, and nothing else', () => {
    expect(isTerminalUploadError(httpError(413))).toBe(true);
    expect(isTerminalUploadError(httpError(422))).toBe(true);
    expect(isTerminalUploadError(httpError(500))).toBe(false);
    expect(isTerminalUploadError(httpError(429))).toBe(false);
  });
});

describe('systemUploadClock', () => {
  it('reads the globals, which is what fakeClock replaces', () => {
    vi.useFakeTimers();

    try {
      const before = systemUploadClock.now();
      const handle = systemUploadClock.setTimeout(() => undefined, 1_000);

      vi.advanceTimersByTime(1_000);
      expect(systemUploadClock.now() - before).toBe(1_000);
      systemUploadClock.clearTimeout(handle);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createUploadTask', () => {
  it('drives init, every chunk in order, then complete', async () => {
    const manual = createManualClock();
    const recording = createRecordingApi();
    const bytes = rampBytes(10);
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(bytes),
      floorId: 'floor-1',
      id: 'task-1',
      projectId: 'project-1',
    });

    expect(task.getState().status).toBe('queued');
    expect(task.getState().chunkCount).toBe(3);

    const final = await runToEnd(task.start, manual);

    expect(recording.initialised).toStrictEqual([
      {
        fileName: 'ban-ve.pdf',
        floorId: 'floor-1',
        mimeType: 'application/pdf',
        projectId: 'project-1',
        sizeBytes: 10,
      },
    ]);
    expect(recording.chunkBodies.map((body) => body.chunkIndex)).toStrictEqual([0, 1, 2]);
    expect(recording.chunkBodies[0]?.chunk).toBe(encodeBytesBase64(bytes.subarray(0, 4)));
    expect(recording.chunkBodies[2]?.chunk).toBe(encodeBytesBase64(bytes.subarray(8, 10)));
    expect(recording.completed).toStrictEqual(['upload-1']);
    expect(final.status).toBe('done');
    expect(final.percent).toBe(100);
    expect(final.chunksSent).toBe(3);
    expect(final.uploadId).toBe('upload-1');
    expect(final.failure).toBeNull();
  });

  it('uploads an empty file with no chunks at all', async () => {
    const manual = createManualClock();
    const recording = createRecordingApi();
    const task = createUploadTask({
      api: recording.api,
      clock: manual.clock,
      file: fakeFile(new Uint8Array(0)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(recording.chunkBodies).toStrictEqual([]);
    expect(recording.completed).toStrictEqual(['upload-1']);
    expect(final.status).toBe('done');
    expect(final.percent).toBe(100);
  });

  it('gives every task an id of its own when none is supplied', () => {
    const manual = createManualClock();
    const build = (): string =>
      createUploadTask({
        api: createRecordingApi().api,
        clock: manual.clock,
        file: fakeFile(rampBytes(4)),
        floorId: 'floor-1',
        projectId: 'project-1',
      }).id;

    expect(build()).not.toBe(build());
  });

  it('retries a failed chunk and then succeeds', async () => {
    const manual = createManualClock();
    let attempts = 0;
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        attempts += 1;

        return attempts === 1 ? failWith(500) : ok(progressAt(50, 'đang tải'));
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(attempts).toBe(2);
    expect(final.status).toBe('done');
  });

  it('gives up after the bounded number of attempts', async () => {
    const manual = createManualClock();
    let attempts = 0;
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        attempts += 1;

        return failWith(500);
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(attempts).toBe(MAX_CHUNK_ATTEMPTS);
    expect(final.status).toBe('failed');
    expect(final.failure).toMatchObject({
      attempts: MAX_CHUNK_ATTEMPTS,
      chunkIndex: 0,
      stage: 'chunk',
      terminal: false,
    });
  });

  it('does not retry a 413, and says the failure was terminal', async () => {
    const manual = createManualClock();
    let attempts = 0;
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        attempts += 1;

        return failWith(413);
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(8)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(attempts).toBe(1);
    expect(final.status).toBe('failed');
    expect(final.failure?.terminal).toBe(true);
    expect(final.failure?.error.kind).toBe('upload');
    expect(final.failure?.attempts).toBe(1);
  });

  it('does not retry a 422 either', async () => {
    const manual = createManualClock();
    let attempts = 0;
    const recording = createRecordingApi({
      complete: async (): Promise<ApiResult<Progress>> => {
        attempts += 1;

        return failWith(422);
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(attempts).toBe(1);
    expect(final.failure).toMatchObject({ stage: 'complete', terminal: true });
    expect(final.failure?.error.kind).toBe('validation');
  });

  it('reports a failure to open the upload against the init stage', async () => {
    const manual = createManualClock();
    const recording = createRecordingApi({
      initUpload: async (): Promise<ApiResult<Progress>> => failWith(413),
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(final.failure).toMatchObject({ chunkIndex: null, stage: 'init', terminal: true });
    expect(recording.chunkBodies).toStrictEqual([]);
  });

  it('stops mid-flight when cancelled, and emits nothing after that', async () => {
    const manual = createManualClock();
    const seen: UploadTaskState[] = [];
    let sent = 0;
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        sent += 1;

        if (sent === 2) {
          task.cancel();
        }

        return ok(progressAt(50, 'đang tải'));
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(40)),
      floorId: 'floor-1',
      onProgress: (state) => seen.push(state),
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(sent).toBe(2);
    expect(recording.completed).toStrictEqual([]);
    expect(final.status).toBe('cancelled');
    expect(seen[seen.length - 1]?.status).toBe('cancelled');
    expect(seen.filter((state) => state.status === 'cancelled')).toHaveLength(1);
  });

  it('never calls the API when the signal is aborted before it starts', async () => {
    const manual = createManualClock();
    const recording = createRecordingApi();
    const controller = new AbortController();

    controller.abort();

    const task = createUploadTask({
      api: recording.api,
      clock: manual.clock,
      file: fakeFile(rampBytes(4)),
      floorId: 'floor-1',
      projectId: 'project-1',
      signal: controller.signal,
    });

    const final = await runToEnd(task.start, manual);

    expect(recording.initialised).toStrictEqual([]);
    expect(final.status).toBe('cancelled');
  });

  it('is cancelled by the caller signal aborting mid-run', async () => {
    const manual = createManualClock();
    const controller = new AbortController();
    let sent = 0;
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        sent += 1;
        controller.abort();

        return ok(progressAt(50, 'đang tải'));
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(20)),
      floorId: 'floor-1',
      projectId: 'project-1',
      signal: controller.signal,
    });

    const final = await runToEnd(task.start, manual);

    expect(sent).toBe(1);
    expect(final.status).toBe('cancelled');
  });

  it('runs once however often start is called', async () => {
    const manual = createManualClock();
    const recording = createRecordingApi();
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4)),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);
    const again = await task.start();

    expect(again).toStrictEqual(final);
    expect(recording.initialised).toHaveLength(1);
  });

  it('emits at most four times a second and still delivers the last state', async () => {
    const manual = createManualClock();
    const emittedAt: number[] = [];
    const seen: UploadTaskState[] = [];
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        // Every chunk costs 60 ms of wall clock, so twenty of them span more
        // than a second and the throttle has something to refuse.
        manual.advance(60);

        return ok(progressAt(50, 'đang tải'));
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(80)),
      floorId: 'floor-1',
      onProgress: (state) => {
        emittedAt.push(manual.now());
        seen.push(state);
      },
      projectId: 'project-1',
    });

    const final = await runToEnd(task.start, manual);

    expect(final.status).toBe('done');
    expect(emittedAt.length).toBeGreaterThan(1);

    for (let index = 1; index < emittedAt.length; index += 1) {
      expect(emittedAt[index]! - emittedAt[index - 1]!).toBeGreaterThanOrEqual(PROGRESS_MIN_GAP_MS);
    }

    for (const start of emittedAt) {
      const inWindow = emittedAt.filter((at) => at >= start && at < start + 1000);

      expect(inWindow.length).toBeLessThanOrEqual(PROGRESS_EMITS_PER_SECOND);
    }

    expect(seen[seen.length - 1]?.status).toBe('done');
    expect(seen[seen.length - 1]?.percent).toBe(100);
  });

  it('reports whole percents as chunks are accepted', async () => {
    const manual = createManualClock();
    const seen: number[] = [];
    const recording = createRecordingApi({
      sendChunk: async (): Promise<ApiResult<Progress>> => {
        manual.advance(PROGRESS_MIN_GAP_MS);

        return ok(progressAt(50, 'đang tải'));
      },
    });
    const task = createUploadTask({
      api: recording.api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(16)),
      floorId: 'floor-1',
      onProgress: (state) => seen.push(state.percent),
      projectId: 'project-1',
    });

    await runToEnd(task.start, manual);

    expect(seen).toContain(25);
    expect(seen).toContain(100);
    expect(seen.every((percent) => Number.isInteger(percent))).toBe(true);
  });
});

describe('createUploadScheduler', () => {
  it('never runs more than three jobs at once', async () => {
    const pool = createUploadScheduler();
    let active = 0;
    let peak = 0;
    const release: Array<() => void> = [];
    const jobs = Array.from({ length: 7 }, async () =>
      pool.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => release.push(resolve));
        active -= 1;

        return active;
      }),
    );

    await settle();
    expect(peak).toBe(MAX_PARALLEL_UPLOADS);
    expect(pool.activeCount()).toBe(MAX_PARALLEL_UPLOADS);
    expect(pool.queuedCount()).toBe(4);

    while (release.length > 0) {
      release.shift()?.();
      await settle(10);
    }

    await Promise.all(jobs);
    expect(peak).toBe(MAX_PARALLEL_UPLOADS);
    expect(pool.activeCount()).toBe(0);
  });

  it('honours a smaller pool when one is asked for', async () => {
    const pool = createUploadScheduler({ maxParallel: 1 });
    const order: number[] = [];
    const jobs = [0, 1, 2].map(async (index) =>
      pool.run(async () => {
        order.push(index);
        await Promise.resolve();
      }),
    );

    await Promise.all(jobs);
    expect(order).toStrictEqual([0, 1, 2]);
  });

  it('frees the slot even when a job throws', async () => {
    const pool = createUploadScheduler({ maxParallel: 1 });

    await expect(
      pool.run(async () => {
        throw new Error('hỏng');
      }),
    ).rejects.toThrow('hỏng');
    expect(pool.activeCount()).toBe(0);
    await expect(pool.run(async () => 'sau đó')).resolves.toBe('sau đó');
  });
});

describe('runUploadQueue', () => {
  it('returns one final state per task, failures included', async () => {
    const manual = createManualClock();
    const good = createUploadTask({
      api: createRecordingApi().api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4), 'tot.pdf'),
      floorId: 'floor-1',
      projectId: 'project-1',
    });
    const bad = createUploadTask({
      api: createRecordingApi({
        initUpload: async (): Promise<ApiResult<Progress>> => failWith(413),
      }).api,
      chunkSizeBytes: 4,
      clock: manual.clock,
      file: fakeFile(rampBytes(4), 'hong.pdf'),
      floorId: 'floor-1',
      projectId: 'project-1',
    });

    const states = await runToEnd(async () => {
      const [first, second] = await runUploadQueue([good, bad]);

      return { ...first!, fileName: `${first!.status}/${second!.status}` };
    }, manual);

    expect(states.fileName).toBe('done/failed');
  });
});
