/**
 * The main thread's half of the GLB export.
 *
 * Everything heavy — regenerating the geometry, welding, encoding the
 * container — happens in `glb.worker.ts`. What runs here is bookkeeping that
 * costs microseconds: naming the file, forwarding progress, wrapping the
 * transferred buffer in a `Blob`. That split is the whole of the "never hold
 * the main thread for more than a frame" promise; there is no throttling
 * trick, there is simply nothing here to throttle.
 *
 * Two more promises this module keeps:
 *
 * - **Nothing is uploaded.** The result is a `Blob` and a file name; whether
 *   that becomes a download, a share or nothing at all is the caller's
 *   decision, made elsewhere.
 * - **Cancelling leaves nothing behind.** The file only ever exists inside the
 *   worker's final message. `cancel()` rejects the promise with
 *   `EXPORT_CANCELLED_MESSAGE` and terminates the worker on the spot, so the
 *   message that would have carried the file is never sent, let alone kept.
 *
 * The worker is single-use: one export, one thread, terminated on the first
 * terminal message. An export is seconds long and rare, so keeping a thread
 * warm between exports would be a leak dressed up as an optimisation.
 */

import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_CANCELLED_MESSAGE,
  type ExportFloor,
  type ExportGlbOptions,
  type ExportGlbRequest,
  type ExportProgress,
  type ExportRequestMessage,
  type ExportResponseMessage,
} from './glb.worker';

export { DEFAULT_EXPORT_OPTIONS, EXPORT_CANCELLED_MESSAGE } from './glb.worker';
export type {
  ExportDetail,
  ExportFloor,
  ExportGlbOptions,
  ExportLevel,
  ExportPhase,
  ExportProgress,
} from './glb.worker';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The little of a `Worker` this module uses, so a test can stand in for one.
 * The handler takes a whole `MessageEvent` for the same reason
 * `BuildWorkerLike` does: a real `Worker` has to satisfy this without a cast.
 */
export interface ExportWorkerLike {
  postMessage(message: ExportRequestMessage): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<ExportResponseMessage>) => void) | null;
}

/** What an export is asked for. */
export interface ExportGlbInput {
  readonly projectName: string;
  readonly projectVersion: string;
  readonly floors: readonly ExportFloor[];
  /** Anything omitted falls back to `DEFAULT_EXPORT_OPTIONS`. */
  readonly options?: Partial<ExportGlbOptions>;
}

/** How the host environment is wired; every field has a production default. */
export interface ExportGlbHostOptions {
  /** How the worker is made. Defaults to the real one; a test passes a stand-in. */
  readonly createWorker?: () => ExportWorkerLike;
  readonly onProgress?: (progress: ExportProgress) => void;
  /** The clock the file name and metadata are stamped from. */
  readonly now?: () => Date;
}

/** The finished file. It goes nowhere until the caller sends it somewhere. */
export interface ExportGlbResult {
  readonly blob: Blob;
  readonly fileName: string;
  readonly byteLength: number;
}

/** A running export: the eventual file, and the handle that stops it. */
export interface ExportGlbTask {
  readonly result: Promise<ExportGlbResult>;
  /**
   * Stop the export. The promise rejects with `EXPORT_CANCELLED_MESSAGE` and
   * the worker is terminated at once; no file, whole or partial, survives.
   * Calling it after the export settled does nothing.
   */
  readonly cancel: () => void;
}

/* -------------------------------------------------------------------------- */
/* The file name.                                                              */
/* -------------------------------------------------------------------------- */

/** The MIME type registered for binary glTF. */
export const GLB_MIME_TYPE = 'model/gltf-binary';

/** One export per worker, so the ticket never needs to vary. */
const EXPORT_TICKET = 1;

/**
 * Vietnamese text without its diacritics, `đ` included.
 *
 * NFD splits each letter from its combining marks, whose whole Unicode block
 * is then dropped; `đ` is its own code point rather than `d` plus a mark, so
 * it is mapped by hand.
 */
export function stripDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** A name as a file-safe slug: ASCII, lower case, hyphens between the words. */
export function toFileSlug(text: string): string {
  const slug = stripDiacritics(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'untitled' : slug;
}

/** `2026-08-17_14-32-05`: sortable, and legal in a file name on every OS. */
export function formatExportTimestamp(date: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');
  const datePart = `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  const timePart = `${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}`;
  return `${datePart}_${timePart}`;
}

/** `T2` for one floor, `T0-T3` for a range, whatever order they arrived in. */
function formatLevelRange(levelOrders: readonly number[]): string {
  const lowest = Math.min(...levelOrders);
  const highest = Math.max(...levelOrders);
  return lowest === highest ? `T${String(lowest)}` : `T${String(lowest)}-T${String(highest)}`;
}

/**
 * The file name the export contract prescribes: the project name without
 * diacritics, the floor range, the date and time.
 *
 * @throws RangeError when there is no floor to name the range from.
 */
export function buildGlbFileName(
  projectName: string,
  levelOrders: readonly number[],
  exportedAt: Date,
): string {
  if (levelOrders.length === 0) {
    throw new RangeError('A file name needs at least one floor for its range.');
  }
  return `${toFileSlug(projectName)}_${formatLevelRange(levelOrders)}_${formatExportTimestamp(exportedAt)}.glb`;
}

/* -------------------------------------------------------------------------- */
/* The export itself.                                                          */
/* -------------------------------------------------------------------------- */

/** The real worker. Vite turns the URL into its own bundle at build time. */
export function createExportGlbWorker(): ExportWorkerLike {
  return new Worker(new URL('./glb.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Export the given floors to a GLB, off the main thread.
 *
 * Returns at once with the running task. The promise settles exactly once:
 * with the finished file, with the worker's error, or with
 * `EXPORT_CANCELLED_MESSAGE` when `cancel` is called first. Whichever way it
 * settles, the worker is terminated before the caller hears about it, so no
 * thread outlives the export it was started for.
 */
export function exportGlb(
  input: ExportGlbInput,
  host: ExportGlbHostOptions = {},
): ExportGlbTask {
  const options: ExportGlbOptions = { ...DEFAULT_EXPORT_OPTIONS, ...input.options };
  const now = host.now ?? (() => new Date());

  let cancelExport: () => void = () => undefined;

  const result = new Promise<ExportGlbResult>((resolve, reject) => {
    if (input.floors.length === 0) {
      reject(new RangeError('An export needs at least one floor.'));
      return;
    }

    const exportedAt = now();
    const fileName = buildGlbFileName(
      input.projectName,
      input.floors.map((floor) => floor.level.order),
      exportedAt,
    );

    let worker: ExportWorkerLike | null = (host.createWorker ?? createExportGlbWorker)();
    let settled = false;

    const close = (): void => {
      if (worker !== null) {
        worker.onmessage = null;
        worker.terminate();
        worker = null;
      }
    };

    const settle = (finish: () => void): void => {
      if (!settled) {
        settled = true;
        finish();
        close();
      }
    };

    cancelExport = () => {
      // Ask politely, then stop waiting: the rejection and the terminate are
      // immediate, so no half-finished result can arrive after a cancel.
      worker?.postMessage({ kind: 'cancel', ticket: EXPORT_TICKET });
      settle(() => {
        reject(new Error(EXPORT_CANCELLED_MESSAGE));
      });
    };

    worker.onmessage = (event) => {
      const message = event.data;
      if (message.ticket !== EXPORT_TICKET) {
        return;
      }

      switch (message.kind) {
        case 'progress':
          if (!settled) {
            host.onProgress?.({
              phase: message.phase,
              completed: message.completed,
              total: message.total,
            });
          }
          break;
        case 'done':
          settle(() => {
            resolve({
              blob: new Blob([message.glb], { type: GLB_MIME_TYPE }),
              fileName,
              byteLength: message.glb.byteLength,
            });
          });
          break;
        case 'cancelled':
          settle(() => {
            reject(new Error(EXPORT_CANCELLED_MESSAGE));
          });
          break;
        case 'error':
          settle(() => {
            reject(new Error(message.message));
          });
          break;
      }
    };

    const request: ExportGlbRequest = {
      projectName: input.projectName,
      projectVersion: input.projectVersion,
      exportedAt: exportedAt.toISOString(),
      floors: input.floors,
      options,
    };
    worker.postMessage({ kind: 'start', ticket: EXPORT_TICKET, request });
  });

  return { result, cancel: () => cancelExport() };
}
