/**
 * The one-way pipe carrying a selection change from the store out to the 2D
 * canvas, the 3D scene and the side list.
 *
 * Picking a wall in the plan has to light it up in 3D and scroll the side list
 * to it. The obvious way to build that — each view holding its own selection
 * and telling the others when it changes — is also the way to build a loop: the
 * list tells the canvas, the canvas tells the scene, the scene tells the list.
 * So the flow here is strictly one-way and the store stays the only place a
 * selection lives.
 *
 * - **Nothing that receives an event can put one back in.** A consumer reports
 *   what it can see through `reportVisible`, and that call never publishes. The
 *   only way to start an event is `push`, which belongs to the store bridge.
 *   That is the structural reason a loop cannot form here, not a convention
 *   anyone has to remember.
 * - **The channel holds no selection of its own.** What is pending is dropped
 *   the moment it is flushed, and there is no way to ask the channel what is
 *   selected — a consumer painting its first frame reads the store, as does
 *   anything reconciling after a reload. Between frames the channel remembers
 *   nothing but what each target can see.
 * - **One publish per frame.** A drag across a dense plan restyles the
 *   selection on every pointer move; ten changes inside one frame are one
 *   publish carrying the last of them, with `coalesced` saying how many were
 *   folded in. The frame scheduler is a port, so tests run on a hand-cranked
 *   clock rather than on `requestAnimationFrame`.
 * - **No geometry, and no Three.js.** The channel moves ids and reveal asks.
 *   Turning a reveal into a camera move is the consumer's job.
 *
 * What each event should contain is decided in `./revealPolicy`; this file is
 * only the plumbing around those decisions.
 */

import type { EntityId } from '@/domain/spatial/types';

import {
  describeSelection,
  planReveals,
  SYNC_TARGETS,
  type RevealRequest,
  type SelectionDetail,
  type SyncTarget,
} from './revealPolicy';
import type { Selection } from './selectionOps';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/** What one target is handed when the selection has settled for a frame. */
export interface SelectionEvent {
  /** The target this copy of the event was delivered to. */
  readonly target: SyncTarget;
  /** The selected ids, by reference; the store's array is never copied. */
  readonly selection: Selection;
  /** How much this target should build — rows, or a tally by kind. */
  readonly detail: SelectionDetail;
  /** Set when this target has to move to show the newest pick. */
  readonly reveal: RevealRequest | null;
  /** How many selection changes were folded into this one publish. */
  readonly coalesced: number;
}

export type SelectionListener = (event: SelectionEvent) => void;

export type FrameHandle = number;

/**
 * The port through which work is deferred to the end of the frame.
 *
 * Injectable so a test can hold the frame open, run the ten changes it wants to
 * see coalesced, and turn the crank itself.
 */
export interface FrameScheduler {
  schedule(run: () => void): FrameHandle;
  cancel(handle: FrameHandle): void;
}

/**
 * The browser's frame, with a fallback for environments without one.
 *
 * `setTimeout(…, 0)` is not a frame, but it preserves the property the channel
 * actually depends on: the flush happens after the caller's current run of
 * work, so a burst of changes still coalesces.
 */
export const defaultFrameScheduler: FrameScheduler = {
  cancel: (handle) => {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle);

      return;
    }

    clearTimeout(handle);
  },
  schedule: (run) => {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(() => {
        run();
      });
    }

    return setTimeout(run, 0) as unknown as FrameHandle;
  },
};

export interface CreateSelectionChannelOptions {
  scheduler?: FrameScheduler;
}

export interface SelectionChannel {
  /** Listens as one of the three targets; the returned function stops it. */
  subscribe: (target: SyncTarget, listener: SelectionListener) => () => void;
  /** Tells the channel what this target can currently show. Never publishes. */
  reportVisible: (target: SyncTarget, ids: readonly EntityId[]) => void;
  /** Feeds a selection change in; the store bridge owns this call. */
  push: (selection: Selection) => void;
  /** Publishes a pending change now instead of at the end of the frame. */
  flush: () => void;
  /** Drops every listener and any pending frame. */
  dispose: () => void;
}

/** Mutable mirror of `VisibleByTarget`, kept inside the channel. */
type VisibleState = { -readonly [K in SyncTarget]?: readonly EntityId[] };

/* -------------------------------------------------------------------------- */
/* The channel.                                                                */
/* -------------------------------------------------------------------------- */

export function createSelectionChannel(
  options: CreateSelectionChannelOptions = {},
): SelectionChannel {
  const scheduler = options.scheduler ?? defaultFrameScheduler;
  const listenersByTarget = new Map<SyncTarget, Set<SelectionListener>>();
  const visible: VisibleState = {};

  let pending: Selection | null = null;
  let pendingChanges = 0;
  let frame: FrameHandle | null = null;

  const cancelFrame = (): void => {
    if (frame !== null) {
      scheduler.cancel(frame);
      frame = null;
    }
  };

  /**
   * Publishes what settled this frame.
   *
   * The pending state is cleared *before* the listeners run, so a consumer that
   * pushes while handling an event schedules the next frame instead of
   * re-entering this one. Listeners are snapshotted for the same reason: one
   * unsubscribing mid-publish must not disturb the others.
   */
  const flush = (): void => {
    cancelFrame();

    if (pending === null) {
      return;
    }

    const selection = pending;
    const coalesced = pendingChanges;

    pending = null;
    pendingChanges = 0;

    const detail = describeSelection(selection);
    const reveals = planReveals(selection, detail, visible);

    for (const target of SYNC_TARGETS) {
      const listeners = listenersByTarget.get(target);

      if (listeners === undefined || listeners.size === 0) {
        continue;
      }

      const event: SelectionEvent = {
        coalesced,
        detail,
        reveal: reveals.find((request) => request.target === target) ?? null,
        selection,
        target,
      };

      for (const listener of [...listeners]) {
        listener(event);
      }
    }
  };

  const push = (selection: Selection): void => {
    pending = selection;
    pendingChanges += 1;

    if (frame === null) {
      frame = scheduler.schedule(flush);
    }
  };

  const reportVisible = (target: SyncTarget, ids: readonly EntityId[]): void => {
    // Deliberately does not publish: this is the only inbound call a consumer
    // can make, and letting it start an event would close the loop.
    visible[target] = ids;
  };

  const subscribe = (target: SyncTarget, listener: SelectionListener): (() => void) => {
    const listeners = listenersByTarget.get(target) ?? new Set<SelectionListener>();

    listeners.add(listener);
    listenersByTarget.set(target, listeners);

    return () => {
      listeners.delete(listener);
    };
  };

  const dispose = (): void => {
    cancelFrame();
    pending = null;
    pendingChanges = 0;
    listenersByTarget.clear();
  };

  return { dispose, flush, push, reportVisible, subscribe };
}
