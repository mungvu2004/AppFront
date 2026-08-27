/**
 * One file, from `initUpload` to `complete`, and the pool that limits how many
 * of them run at once.
 *
 * A task owns the whole life of a single upload: it cuts the file with
 * `./chunk`, posts the pieces in order through the **injected** `DrawingsApi`,
 * retries the ones worth retrying, and reports a state a screen can render
 * without deriving anything from it. Four decisions are made here and nowhere
 * else, which is the point of the module:
 *
 * - **Three files at a time.** {@link MAX_PARALLEL_UPLOADS} is the only place
 *   that number is written. {@link createUploadScheduler} owns it; a screen
 *   that counts in-flight uploads by hand has forked the rule.
 * - **Three attempts per chunk.** {@link MAX_CHUNK_ATTEMPTS} counts the first
 *   try, so a chunk is retried twice. The delays between them are the
 *   transport's own {@link RETRY_DELAYS_MS}, not a second ladder invented here.
 * - **413 and 422 are the end.** Both mean the server has judged the *content*
 *   — too large, or malformed — so trying again cannot change the answer.
 *   `toAppError` already maps them to the `upload` and `validation` kinds, and
 *   {@link isTerminalUploadError} reads that mapping rather than re-deriving it
 *   from status codes.
 * - **At most four progress emissions per second, per task.** Every emission
 *   goes through a throttle whose minimum gap is
 *   {@link PROGRESS_MIN_GAP_MS}. It is fed by an injected {@link UploadClock},
 *   which by default is the global `Date.now` / `setTimeout` pair — the pair
 *   `src/lib/testing/fakeClock` replaces — so the rate is assertable without
 *   waiting on a real second.
 *
 * ## The last emission is guaranteed, not immediate
 *
 * A terminal state — `done` at 100%, `failed`, `cancelled` — is always
 * delivered, even when it lands inside a throttle window. It is delivered *at
 * the end of that window* rather than through it, because emitting it early
 * would be the one case that pushes a second past four emissions. {@link
 * UploadTask.start} resolves only after that delivery, so a caller that awaits
 * the task has seen the final state. A screen that wants the terminal state a
 * few milliseconds sooner can read {@link UploadTask.getState}, which is never
 * throttled.
 *
 * ## Cancelling
 *
 * {@link UploadTask.cancel} — or aborting the signal handed in — stops the run
 * at the next boundary, drops the in-flight request through the same signal,
 * and emits `cancelled` once. No progress emission follows it.
 */

import type { ApiResult, DrawingsApi, Progress } from '@/api/client';
import type { AppError, AppErrorKind } from '@/lib/errors';
import { toAppError } from '@/lib/errors';
import { createUuid, RETRY_DELAYS_MS } from '@/lib/http';

import { countUploadChunks, encodeChunkBase64, sliceIntoChunks, UPLOAD_CHUNK_SIZE_BYTES } from './chunk';

/**
 * How many files upload at the same time.
 *
 * The one and only home of this number. Three is a compromise between a single
 * queue that wastes a fast connection and a fan-out that starves the rest of
 * the application of sockets.
 */
export const MAX_PARALLEL_UPLOADS = 3;

/**
 * Tries a single chunk gets, the first one included.
 *
 * Three attempts means two retries. The one and only home of this number.
 */
export const MAX_CHUNK_ATTEMPTS = 3;

/** Progress emissions allowed per second, per task. */
export const PROGRESS_EMITS_PER_SECOND = 4;

/** The smallest gap between two emissions from one task: 250 ms. */
export const PROGRESS_MIN_GAP_MS = 1000 / PROGRESS_EMITS_PER_SECOND;

/** Where an upload was when it failed. */
export type UploadStage = 'init' | 'chunk' | 'complete';

/** Where an upload is now. */
export type UploadTaskStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'cancelled';

/** Why an upload stopped, already mapped to the application's error vocabulary. */
export interface UploadFailure {
  /** Which call failed. */
  readonly stage: UploadStage;
  /** The mapped error — `kind`, `severity`, `recovery` and the message key. */
  readonly error: AppError;
  /** How many times the failing call was attempted. */
  readonly attempts: number;
  /** `true` when retrying could not have helped: a 413 or a 422. */
  readonly terminal: boolean;
  /** Which chunk, when `stage` is `'chunk'`. `null` otherwise. */
  readonly chunkIndex: number | null;
}

/**
 * Everything a screen needs to draw one row of the upload list.
 *
 * Every field is filled in on every snapshot — nothing is optional — so a view
 * never has to test for presence before rendering.
 */
export interface UploadTaskState {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly status: UploadTaskStatus;
  /** Whole percent, `0`–`100`, counted from chunks accepted by the server. */
  readonly percent: number;
  readonly chunkCount: number;
  readonly chunksSent: number;
  /** The upload the server opened, once `initUpload` has answered. */
  readonly uploadId: string | null;
  /** The last `Progress` the server sent, for the pipeline step it names. */
  readonly progress: Progress | null;
  /** Filled in exactly when `status` is `'failed'`. */
  readonly failure: UploadFailure | null;
}

/** The handle a timer is remembered by, whichever runtime supplies it. */
export type UploadTimerHandle = ReturnType<typeof setTimeout>;

/**
 * The two pieces of time this module uses.
 *
 * Injecting them is what makes the emission rate assertable: a test hands in a
 * clock it steps by hand, or installs `src/lib/testing/fakeClock`, which
 * replaces the globals the default clock reads.
 */
export interface UploadClock {
  readonly now: () => number;
  readonly setTimeout: (handler: () => void, delayMs: number) => UploadTimerHandle;
  readonly clearTimeout: (handle: UploadTimerHandle) => void;
}

/** The subset of the file API an upload needs. `File` satisfies it. */
export interface UploadFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  slice: (start?: number, end?: number) => Blob;
}

/** What {@link createUploadTask} needs to drive one file. */
export interface CreateUploadTaskOptions {
  /** The injected client. Never a singleton — that is what makes this testable. */
  readonly api: DrawingsApi;
  readonly file: UploadFile;
  readonly floorId: string;
  readonly projectId: string;
  /** Called with every state change, throttled to {@link PROGRESS_EMITS_PER_SECOND}. */
  readonly onProgress?: (state: UploadTaskState) => void;
  /** Cancels the run. Aborting it is the same as calling {@link UploadTask.cancel}. */
  readonly signal?: AbortSignal;
  /** Defaults to the global timers. */
  readonly clock?: UploadClock;
  /** Defaults to a fresh UUID. */
  readonly id?: string;
  /** Defaults to {@link UPLOAD_CHUNK_SIZE_BYTES}. */
  readonly chunkSizeBytes?: number;
  /** Defaults to {@link MAX_CHUNK_ATTEMPTS}. */
  readonly maxAttempts?: number;
  /** Defaults to {@link PROGRESS_MIN_GAP_MS}. */
  readonly progressMinGapMs?: number;
}

/** One file's upload, already built but not yet started. */
export interface UploadTask {
  readonly id: string;
  /** The current state, never throttled. */
  readonly getState: () => UploadTaskState;
  /** Run it. Resolves with the final state, after the final emission. */
  readonly start: () => Promise<UploadTaskState>;
  /** Stop it. Safe before, during and after {@link UploadTask.start}. */
  readonly cancel: () => void;
}

/** What {@link createUploadScheduler} accepts. */
export interface CreateUploadSchedulerOptions {
  /** Defaults to {@link MAX_PARALLEL_UPLOADS}. */
  readonly maxParallel?: number;
}

/** A pool that never lets more than `maxParallel` jobs run at once. */
export interface UploadScheduler {
  readonly run: <T>(job: () => Promise<T>) => Promise<T>;
  readonly activeCount: () => number;
  readonly queuedCount: () => number;
}

/**
 * Errors that no retry can fix.
 *
 * `upload` is what `toAppError` calls a 413 and `validation` is what it calls a
 * 422 — both are judgements about the bytes, so the same bytes get the same
 * answer next time.
 */
const TERMINAL_ERROR_KINDS: ReadonlySet<AppErrorKind> = new Set<AppErrorKind>(['upload', 'validation']);

/** Percent of a whole. */
const FULL_PERCENT = 100;

/** The default clock: the globals, which `fakeClock` replaces wholesale. */
export const systemUploadClock: UploadClock = {
  clearTimeout: (handle: UploadTimerHandle): void => {
    clearTimeout(handle);
  },
  now: (): number => Date.now(),
  setTimeout: (handler: () => void, delayMs: number): UploadTimerHandle =>
    setTimeout(handler, delayMs),
};

/**
 * Would retrying this error have been pointless?
 *
 * @example
 * isTerminalUploadError({ kind: 'http', status: 413, requestId: 'r', retryable: false, raw: {} })   // true
 */
export function isTerminalUploadError(error: unknown): boolean {
  return TERMINAL_ERROR_KINDS.has(toAppError(error).kind);
}

/**
 * A pool that runs at most `maxParallel` jobs at a time, in submission order.
 *
 * @example
 * const pool = createUploadScheduler();
 * const states = await Promise.all(tasks.map((task) => pool.run(() => task.start())));
 */
export function createUploadScheduler(options: CreateUploadSchedulerOptions = {}): UploadScheduler {
  const maxParallel = Math.max(1, options.maxParallel ?? MAX_PARALLEL_UPLOADS);
  const waiting: Array<() => void> = [];
  let active = 0;

  const takeSlot = async (): Promise<void> => {
    if (active < maxParallel) {
      active += 1;

      return;
    }

    await new Promise<void>((resolve) => {
      waiting.push(resolve);
    });
    active += 1;
  };

  const releaseSlot = (): void => {
    active -= 1;

    const next = waiting.shift();

    next?.();
  };

  return {
    activeCount: (): number => active,
    queuedCount: (): number => waiting.length,
    run: async <T>(job: () => Promise<T>): Promise<T> => {
      await takeSlot();

      try {
        return await job();
      } finally {
        releaseSlot();
      }
    },
  };
}

/**
 * Run a batch of tasks through one pool and wait for all of them.
 *
 * One file's failure never stops another's — every task resolves with its own
 * final state, failed or not.
 *
 * @example
 * const states = await runUploadQueue(files.map((file) => createUploadTask({ api, file, … })));
 */
export async function runUploadQueue(
  tasks: readonly UploadTask[],
  options: CreateUploadSchedulerOptions = {},
): Promise<UploadTaskState[]> {
  const pool = createUploadScheduler(options);

  return Promise.all(tasks.map(async (task) => pool.run(async () => task.start())));
}

/**
 * Build the upload of one file. Nothing happens until {@link UploadTask.start}.
 *
 * @example
 * const task = createUploadTask({ api: client.drawings, file, floorId, projectId, onProgress: setRow });
 * const finalState = await task.start();
 */
export function createUploadTask(options: CreateUploadTaskOptions): UploadTask {
  const clock = options.clock ?? systemUploadClock;
  const chunkSizeBytes = options.chunkSizeBytes ?? UPLOAD_CHUNK_SIZE_BYTES;
  const maxAttempts = Math.max(1, options.maxAttempts ?? MAX_CHUNK_ATTEMPTS);
  const minGapMs = options.progressMinGapMs ?? PROGRESS_MIN_GAP_MS;
  const controller = new AbortController();
  const taskId = options.id ?? createUuid();

  linkSignal(options.signal, controller);

  let state: UploadTaskState = {
    chunkCount: countUploadChunks(options.file.size, chunkSizeBytes),
    chunksSent: 0,
    failure: null,
    fileName: options.file.name,
    id: taskId,
    percent: 0,
    progress: null,
    sizeBytes: options.file.size,
    status: 'queued',
    uploadId: null,
  };
  let started = false;

  const emitter = createThrottledEmitter<UploadTaskState>(
    (value) => options.onProgress?.(value),
    clock,
    minGapMs,
  );

  const publish = async (patch: Partial<UploadTaskState>, isFinal = false): Promise<void> => {
    state = { ...state, ...patch };

    await emitter.emit(state, isFinal);
  };

  const wait = (delayMs: number): Promise<void> =>
    new Promise<void>((resolve) => {
      if (delayMs <= 0 || controller.signal.aborted) {
        resolve();

        return;
      }

      let handle: UploadTimerHandle | null = null;
      const onAbort = (): void => {
        if (handle !== null) {
          clock.clearTimeout(handle);
        }

        resolve();
      };

      handle = clock.setTimeout(() => {
        controller.signal.removeEventListener('abort', onAbort);
        resolve();
      }, delayMs);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });

  const finishCancelled = async (): Promise<UploadTaskState> => {
    await publish({ status: 'cancelled' }, true);
    emitter.dispose();

    return state;
  };

  const finishFailed = async (failure: UploadFailure): Promise<UploadTaskState> => {
    await publish({ failure, status: 'failed' }, true);
    emitter.dispose();

    return state;
  };

  /**
   * One call, retried while retrying can still change the answer.
   *
   * `null` means the run was cancelled before or between attempts — a
   * different thing from a call that failed, and the caller treats it so.
   */
  const attempt = async (call: () => Promise<ApiResult<Progress>>): Promise<AttemptOutcome | null> => {
    let attempts = 0;

    for (;;) {
      if (controller.signal.aborted) {
        return null;
      }

      attempts += 1;

      const result = await call();

      if (result.ok || isTerminalUploadError(result.error) || attempts >= maxAttempts) {
        return { attempts, result };
      }

      await wait(retryDelayMs(attempts - 1));
    }
  };

  const toFailure = (
    stage: UploadStage,
    chunkIndex: number | null,
    error: unknown,
    attempts: number,
  ): UploadFailure => ({
    attempts,
    chunkIndex,
    error: toAppError(error),
    stage,
    terminal: isTerminalUploadError(error),
  });

  const start = async (): Promise<UploadTaskState> => {
    if (started) {
      return state;
    }

    started = true;

    if (controller.signal.aborted) {
      return finishCancelled();
    }

    await publish({ status: 'uploading' });

    const init = await attempt(async () =>
      options.api.initUpload({
        body: {
          fileName: options.file.name,
          floorId: options.floorId,
          mimeType: options.file.type,
          projectId: options.projectId,
          sizeBytes: options.file.size,
        },
        signal: controller.signal,
      }),
    );

    if (init === null) {
      return finishCancelled();
    }

    if (!init.result.ok) {
      return finishFailed(toFailure('init', null, init.result.error, init.attempts));
    }

    const uploadId = init.result.data.id;

    await publish({ progress: init.result.data, uploadId });

    const chunks = sliceIntoChunks(options.file.slice(0, options.file.size), chunkSizeBytes);

    for (const chunk of chunks) {
      if (controller.signal.aborted) {
        return finishCancelled();
      }

      const encoded = await encodeChunkBase64(chunk.blob);
      const sent = await attempt(async () =>
        options.api.sendChunk({
          body: { chunk: encoded, chunkIndex: chunk.index },
          projectId: options.projectId,
          signal: controller.signal,
          uploadId,
        }),
      );

      if (sent === null) {
        return finishCancelled();
      }

      if (!sent.result.ok) {
        return finishFailed(toFailure('chunk', chunk.index, sent.result.error, sent.attempts));
      }

      const chunksSent = chunk.index + 1;

      await publish({
        chunksSent,
        percent: percentOf(chunksSent, chunks.length),
        progress: sent.result.data,
      });
    }

    if (controller.signal.aborted) {
      return finishCancelled();
    }

    const completed = await attempt(async () =>
      options.api.complete({
        body: { uploadId },
        projectId: options.projectId,
        signal: controller.signal,
      }),
    );

    if (completed === null) {
      return finishCancelled();
    }

    if (!completed.result.ok) {
      return finishFailed(toFailure('complete', null, completed.result.error, completed.attempts));
    }

    await publish({ percent: FULL_PERCENT, progress: completed.result.data, status: 'done' }, true);
    emitter.dispose();

    return state;
  };

  return {
    cancel: (): void => {
      controller.abort();
    },
    getState: (): UploadTaskState => state,
    id: taskId,
    start,
  };
}

/** What one retried call ended up with, and how many tries it took. */
interface AttemptOutcome {
  readonly attempts: number;
  readonly result: ApiResult<Progress>;
}

/**
 * Make the caller's signal cancel this task too.
 *
 * The task keeps its own controller rather than passing the caller's signal
 * straight down, so {@link UploadTask.cancel} works even when no signal was
 * handed in — and so one shared signal can cancel a whole batch.
 */
function linkSignal(signal: AbortSignal | undefined, controller: AbortController): void {
  if (signal === undefined) {
    return;
  }

  if (signal.aborted) {
    controller.abort();

    return;
  }

  signal.addEventListener(
    'abort',
    () => {
      controller.abort();
    },
    { once: true },
  );
}

/** Whole percent from chunks accepted, never above 100. */
function percentOf(chunksSent: number, chunkCount: number): number {
  if (chunkCount <= 0) {
    return FULL_PERCENT;
  }

  return Math.min(FULL_PERCENT, Math.floor((chunksSent / chunkCount) * FULL_PERCENT));
}

/** The transport's own backoff ladder, reused rather than reinvented. */
function retryDelayMs(attemptIndex: number): number {
  const last = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 0;

  return RETRY_DELAYS_MS[attemptIndex] ?? last;
}

/** A value waiting to go out, distinguishable from "nothing waiting". */
interface PendingEmission<T> {
  readonly value: T;
}

/** What {@link createThrottledEmitter} hands back. */
interface ThrottledEmitter<T> {
  /**
   * Offer a value. Resolves immediately for an ordinary emission; for a final
   * one, resolves only once the value has actually reached the listener.
   */
  readonly emit: (value: T, isFinal?: boolean) => Promise<void>;
  /** Drop anything still waiting and forget the timer. */
  readonly dispose: () => void;
}

/**
 * A rate limiter with a memory: at most one delivery per `minGapMs`, and the
 * value delivered is always the most recent one offered.
 *
 * Leading-edge, so the first offer goes out at once and a short upload is not
 * silent for a quarter of a second.
 */
function createThrottledEmitter<T>(
  listener: (value: T) => void,
  clock: UploadClock,
  minGapMs: number,
): ThrottledEmitter<T> {
  let lastEmitAt: number | null = null;
  let timer: UploadTimerHandle | null = null;
  let pending: PendingEmission<T> | null = null;
  let pendingResolve: (() => void) | null = null;

  const deliver = (value: T): void => {
    lastEmitAt = clock.now();
    listener(value);
  };

  const settle = (): void => {
    const resolve = pendingResolve;

    pendingResolve = null;
    resolve?.();
  };

  const flush = (): void => {
    timer = null;

    const waiting = pending;

    pending = null;

    if (waiting !== null) {
      deliver(waiting.value);
    }

    settle();
  };

  const remainingMs = (): number =>
    lastEmitAt === null ? 0 : minGapMs - (clock.now() - lastEmitAt);

  return {
    dispose: (): void => {
      if (timer !== null) {
        clock.clearTimeout(timer);
        timer = null;
      }

      pending = null;
      settle();
    },
    emit: async (value: T, isFinal = false): Promise<void> => {
      const remaining = remainingMs();

      if (remaining <= 0) {
        if (timer !== null) {
          clock.clearTimeout(timer);
          timer = null;
        }

        pending = null;
        deliver(value);
        settle();

        return;
      }

      pending = { value };

      if (timer === null) {
        timer = clock.setTimeout(flush, remaining);
      }

      if (!isFinal) {
        return;
      }

      await new Promise<void>((resolve) => {
        const earlier = pendingResolve;

        pendingResolve = (): void => {
          earlier?.();
          resolve();
        };
      });
    },
  };
}
