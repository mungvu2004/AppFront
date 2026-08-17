/**
 * Four storeys, four pictures, one at a time — and a way to stop.
 *
 * "Give me a shot of every floor" is one request, but it is not one capture: the
 * viewer can only show one storey at a time, so the queue shows a storey, takes
 * its picture, shows the next, and so on. Three things make that worth a module
 * rather than a `for` loop at a call site.
 *
 * - **Nothing accumulates.** Each capture renders into its own offscreen target
 *   and frees it before returning — see `screenshot.ts` — and this queue holds
 *   no pixels of its own between storeys. Four captures therefore cost one
 *   target's worth of graphics memory, not four, and the test file proves it by
 *   counting every buffer taken and every buffer given back. A queue that kept
 *   the read-back buffers to hand them over at the end would undo that in the
 *   most invisible way possible: `resolution: 3` over four storeys is around
 *   168 MB of them, half the whole scene budget.
 * - **It says where it has got to.** A run is seconds long per storey, and a
 *   progress report that only counts finished storeys leaves the interface
 *   silent through the slowest part — rebuilding the scene for the next one. So
 *   there are two reports per storey: {@link ScreenshotQueuePhase} `showing`
 *   while the viewer changes floors, and `capturing` while the picture is taken.
 * - **It stops when asked, and puts the viewer back.** {@link
 *   ScreenshotQueue.cancel} drops everything still queued, and whether a run
 *   finishes, is cancelled or fails, the storey the reviewer was on is restored
 *   in a `finally`. A batch export that leaves somebody on the fourth floor of
 *   a building they were reviewing the ground floor of has changed the very
 *   thing the capture promised not to change.
 *
 * **Cancelling does not abandon the capture in flight.** It is allowed to
 * finish, because the thing that frees its render target is its own `finally`,
 * and a caller who could not wait one render for that would be trading a leak
 * for a few hundred milliseconds. Everything after it is dropped.
 *
 * The queue owns no renderer, no canvas and no store. It is given a function
 * that shows a storey and a function that photographs one — which is what lets
 * its whole behaviour be tested without a WebGL context, and what keeps
 * `src/lib` free of the store the storey actually lives in.
 *
 * ## Field names
 *
 * The brief names this `hangDoiChup` with `tienDo` and `huy`. Invariants B and
 * E.11 of `CLAUDE.md` forbid Vietnamese identifiers, so the class is
 * {@link ScreenshotQueue}, the report is {@link ScreenshotQueueProgress} and the
 * stop is {@link ScreenshotQueue.cancel}. Every string a person reads stays
 * Vietnamese.
 */

import type { LevelId } from '@/domain/spatial/types';
import { formatNumber } from '@/lib/format/number';

import {
  captureViewport,
  type CaptureHostOptions,
  type CaptureResult,
  type CaptureViewportInput,
} from './screenshot';

/* -------------------------------------------------------------------------- */
/* What a job is.                                                              */
/* -------------------------------------------------------------------------- */

/** One storey to photograph. */
export interface ScreenshotJob {
  readonly levelId: LevelId;
  /** How the storey picker names it; printed in the band and the file name. */
  readonly levelName: string;
}

/** Which half of a storey's turn the run is in. */
export type ScreenshotQueuePhase =
  /** The viewer is being switched to this storey. */
  | 'showing'
  /** The picture is being taken. */
  | 'capturing';

/** How a run ended. */
export type ScreenshotQueueStatus =
  /** Every queued storey was photographed. */
  | 'done'
  /** {@link ScreenshotQueue.cancel} was called; the rest were dropped. */
  | 'cancelled'
  /** A storey could not be shown or could not be photographed. */
  | 'failed';

/** Where a run has got to. */
export interface ScreenshotQueueProgress {
  readonly phase: ScreenshotQueuePhase;
  /** Storeys already photographed. */
  readonly completed: number;
  /**
   * Storeys this run knows about: finished, current, and still queued.
   *
   * It can grow — {@link ScreenshotQueue.enqueue} may be called while a run is
   * going — and reporting the total as it stands is honest where reporting the
   * total it started with would not be.
   */
  readonly total: number;
  readonly levelId: LevelId;
  readonly levelName: string;
  /** Vietnamese sentence, ready for a status line. */
  readonly message: string;
}

/** What a whole run produced. */
export interface ScreenshotQueueOutcome {
  readonly status: ScreenshotQueueStatus;
  /** The pictures taken, in the order they were queued. */
  readonly images: readonly CaptureResult[];
  /** Storeys that were queued and never photographed. */
  readonly skipped: readonly ScreenshotJob[];
  /** Why the run failed; `null` for every other ending. */
  readonly failure: string | null;
}

export interface ScreenshotQueueOptions {
  /**
   * Photograph the storey the viewer is currently showing.
   *
   * Usually {@link createFloorCapture}. It must free whatever it allocates
   * before it resolves; the queue frees nothing on its behalf.
   */
  readonly capture: (job: ScreenshotJob) => Promise<CaptureResult>;
  /**
   * Show a storey, and resolve once the viewer is really showing it.
   *
   * Resolving early is the one way to get a wrong picture out of this queue:
   * the capture that follows renders whatever the scene holds at that instant.
   */
  readonly showFloor: (job: ScreenshotJob) => void | Promise<void>;
  /**
   * Put the viewer back on the storey the reviewer was on.
   *
   * Called exactly once per run, however the run ends. Left out only by a
   * caller whose viewer shows every storey at once.
   */
  readonly restore?: () => void | Promise<void>;
  readonly onProgress?: (progress: ScreenshotQueueProgress) => void;
  /**
   * Each picture, the moment it exists.
   *
   * For a caller that wants to write files as they arrive rather than wait for
   * the whole run.
   */
  readonly onImage?: (image: CaptureResult, job: ScreenshotJob) => void;
}

/* -------------------------------------------------------------------------- */
/* Wording.                                                                    */
/* -------------------------------------------------------------------------- */

const PHASE_VERBS: Readonly<Record<ScreenshotQueuePhase, string>> = {
  showing: 'Đang mở',
  capturing: 'Đang chụp',
};

/**
 * `"Đang chụp Tầng 2 (2/4)."` — what a status line shows.
 *
 * The storey's own name carries the word "tầng" already, so the verb does not
 * repeat it: a message reading "Đang chụp tầng Tầng 2" is what happens when a
 * sentence is built out of two halves that both name the thing.
 */
export function progressMessage(
  phase: ScreenshotQueuePhase,
  levelName: string,
  completed: number,
  total: number,
): string {
  const position = `${formatNumber(completed + 1, { fractionDigits: 0 })}/${formatNumber(total, { fractionDigits: 0 })}`;

  return `${PHASE_VERBS[phase]} ${levelName} (${position}).`;
}

/** Said when a run is cancelled, for a caller that wants to explain the ending. */
export const QUEUE_CANCELLED_MESSAGE = 'Đã huỷ chụp hàng loạt; các tầng còn lại không được chụp.';

/* -------------------------------------------------------------------------- */
/* Capturing one storey.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A capture function for a queue: one set of capture settings, one storey name
 * per job.
 *
 * Everything but the storey name is fixed when the run is set up — the same
 * renderer, camera, options and palette photograph every floor, which is what
 * makes four pictures comparable to each other.
 *
 * @example
 * const queue = new ScreenshotQueue({
 *   capture: createFloorCapture(input),
 *   showFloor: (job) => viewer.showLevel(job.levelId),
 *   restore: () => viewer.showLevel(currentLevelId),
 * });
 */
export function createFloorCapture(
  input: CaptureViewportInput,
  host: CaptureHostOptions = {},
): (job: ScreenshotJob) => Promise<CaptureResult> {
  return (job) =>
    captureViewport(
      input.info === undefined
        ? input
        : { ...input, info: { ...input.info, levelName: job.levelName } },
      host,
    );
}

/* -------------------------------------------------------------------------- */
/* The queue.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Photograph storeys one after another, with progress and a stop.
 *
 * ```ts
 * const queue = new ScreenshotQueue({ capture, showFloor, restore, onProgress });
 * queue.enqueue(floors);
 * const outcome = await queue.run();   // 'done' | 'cancelled' | 'failed'
 * ```
 *
 * `run` settles exactly once, whatever happens, and never rejects: a failed
 * storey comes back as {@link ScreenshotQueueOutcome.failure} beside the
 * pictures that were taken before it, because a run that photographed three
 * floors and then hit a bad one has still produced three usable files.
 */
export class ScreenshotQueue {
  private readonly options: ScreenshotQueueOptions;
  private readonly queued: ScreenshotJob[] = [];
  private readonly images: CaptureResult[] = [];

  private running: Promise<ScreenshotQueueOutcome> | null = null;
  private cancelled = false;
  private completed = 0;

  constructor(options: ScreenshotQueueOptions) {
    this.options = options;
  }

  /** Storeys queued and not yet photographed. */
  get pendingCount(): number {
    return this.queued.length;
  }

  /** Storeys photographed in the run so far. */
  get completedCount(): number {
    return this.completed;
  }

  /** Is a run in progress? */
  get isRunning(): boolean {
    return this.running !== null;
  }

  /** Has this queue been cancelled? */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Add storeys to the back of the queue.
   *
   * May be called while a run is going, and the new storeys join that run —
   * which is what makes this a queue rather than a batch. Adding to a cancelled
   * queue does nothing, so a late click cannot restart a run somebody stopped.
   */
  enqueue(jobs: readonly ScreenshotJob[]): void {
    if (this.cancelled) {
      return;
    }
    this.queued.push(...jobs);
  }

  /**
   * Drain the queue, one storey at a time.
   *
   * Calling it while a run is going returns that same run rather than starting
   * a second one over the same viewer — two runs switching storeys underneath
   * each other would photograph neither reliably.
   */
  run(): Promise<ScreenshotQueueOutcome> {
    this.running ??= this.drain().finally(() => {
      this.running = null;
    });

    return this.running;
  }

  /**
   * Stop after the storey being photographed right now.
   *
   * The capture in flight is allowed to finish so that it frees its own
   * offscreen buffer; everything still queued is dropped and reported as
   * {@link ScreenshotQueueOutcome.skipped}. Calling it on a queue that is not
   * running still marks the queue cancelled, so a run started afterwards ends
   * at once rather than photographing what somebody has already said no to.
   */
  cancel(): void {
    this.cancelled = true;
  }

  /** The loop: show, photograph, report, and put the viewer back at the end. */
  private async drain(): Promise<ScreenshotQueueOutcome> {
    const skipped: ScreenshotJob[] = [];
    let status: ScreenshotQueueStatus = 'done';
    let failure: string | null = null;

    try {
      for (;;) {
        if (this.cancelled) {
          status = 'cancelled';
          break;
        }

        const job = this.queued.shift();
        if (job === undefined) {
          break;
        }

        try {
          this.report('showing', job);
          await this.options.showFloor(job);

          this.report('capturing', job);
          const image = await this.options.capture(job);

          this.images.push(image);
          this.completed += 1;
          this.options.onImage?.(image, job);
        } catch (cause) {
          status = 'failed';
          failure = cause instanceof Error ? cause.message : String(cause);
          skipped.push(job);
          break;
        }
      }
    } finally {
      // Whatever happened, the reviewer gets their storey back. The restore is
      // awaited inside the same run so a caller that awaits `run()` knows the
      // viewer has settled by the time it resolves — and a restore that throws
      // is reported rather than thrown, because the pictures already taken are
      // still good and a rejected promise would hand back none of them.
      try {
        await this.options.restore?.();
      } catch (cause) {
        if (status === 'done') {
          status = 'failed';
          failure = cause instanceof Error ? cause.message : String(cause);
        }
      }
    }

    skipped.push(...this.queued.splice(0, this.queued.length));

    return { status, images: [...this.images], skipped, failure };
  }

  /** One progress report, with the total as it stands right now. */
  private report(phase: ScreenshotQueuePhase, job: ScreenshotJob): void {
    if (this.options.onProgress === undefined) {
      return;
    }

    // The storey being worked on has already been taken off the queue, so it is
    // counted back in: finished + this one + the ones still waiting.
    const total = this.completed + 1 + this.queued.length;

    this.options.onProgress({
      phase,
      completed: this.completed,
      total,
      levelId: job.levelId,
      levelName: job.levelName,
      message: progressMessage(phase, job.levelName, this.completed, total),
    });
  }
}
