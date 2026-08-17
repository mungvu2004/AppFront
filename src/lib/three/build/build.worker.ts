/**
 * The worker entry point for the incremental build.
 *
 * Everything this thread computes lives in `buildCore.ts`, which is pure and
 * safe to import from anywhere — a test, another worker — without a side
 * effect. This file is the one place that talks to the worker global, and it
 * is kept this thin on purpose: importing a module must never install a
 * message handler as a side effect, and before the split this one did exactly
 * that, which left any second worker importing `buildParts` silently racing it
 * for `onmessage`. The GLB export worker imports the core, not this file, for
 * precisely that reason.
 *
 * The re-exports keep the module's public face where it always was: the queue
 * and the tests name `build.worker` for the protocol types and the compute
 * functions, and nothing outside this package has to know the split happened.
 */

import { respondTo, transferablesOf } from './buildCore';
import type { BuildRequestMessage, BuildResponseMessage } from './buildCore';

export { buildParts, respondTo, transferablesOf } from './buildCore';
export type {
  BuildJob,
  BuildRequestMessage,
  BuildResponseMessage,
  BuiltPartBuffers,
  RoomBuildJob,
  WallBuildJob,
} from './buildCore';

/* -------------------------------------------------------------------------- */
/* Worker plumbing.                                                            */
/* -------------------------------------------------------------------------- */

/** The little of a worker global this file uses. */
interface WorkerScope {
  onmessage: ((event: { data: BuildRequestMessage }) => void) | null;
  postMessage: (message: BuildResponseMessage, transfer: Transferable[]) => void;
}

/**
 * Install the handler, but only in a worker.
 *
 * A test imports this module for its re-exports, and a document context has
 * its own `onmessage` that nothing here has any business claiming. The absence
 * of a `document` is what tells the two apart.
 */
if (typeof document === 'undefined') {
  const scope = globalThis as unknown as WorkerScope;

  scope.onmessage = (event) => {
    const response = respondTo(event.data);
    scope.postMessage(response, 'parts' in response ? transferablesOf(response.parts) : []);
  };
}
