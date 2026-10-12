import { createUuid } from '@/lib/http/ids';
import type { Result } from '@/lib/http/types';

/**
 * How long an undo stays available: invariant A8's eight seconds.
 *
 * Exported because three modules need the same number and they cannot all own
 * it — `useUndoableToast` schedules the toast's disappearance by it,
 * `components/feedback/Toast` draws the countdown bar from it, and the ticket
 * below expires by it. It lives here because `src/lib` is the only layer the
 * other two are allowed to import from (CLAUDE.md 0.4), and because a ticket's
 * lifetime is the thing the window actually *is* — the toast is how it is drawn.
 *
 * It was written out four times before this, once per consumer. Changing A8 in
 * one of them would have left a progress bar emptying at a speed that no longer
 * matched when the undo really stopped working, with nothing to catch it.
 */
export const UNDO_WINDOW_MS = 8000;

export type UndoTicketStatus = 'active' | 'expired' | 'used';

export type UndoTicketError = 'expired';

export interface CreateUndoTicketOptions {
  description: string;
  now?: () => number;
  ttlMs?: number;
  undo: () => void;
}

export interface UndoTicket {
  description: string;
  /** Moves later while a hold is on ({@link holdUndoWindows}); read it when you need it, do not keep it. */
  readonly expiresAt: number;
  getStatus: () => UndoTicketStatus;
  id: string;
  undo: () => Result<void, UndoTicketError>;
}

let activeHolds = 0;
let heldSince = 0;
let heldBeforeMs = 0;

/** Wall-clock milliseconds spent under a hold so far, the current one included. */
const heldMs = (): number => heldBeforeMs + (activeHolds > 0 ? Date.now() - heldSince : 0);

/**
 * Stops every undo window's clock until the returned release is called (BUG-571,
 * WCAG 2.2.1): a person hovering or focusing an undo toast is reading it or
 * reaching for "Hoàn tác", and the ticket behind the button must still say yes
 * when they press it. Holds nest (hover and focus at once); a release runs once.
 *
 * ponytail: one hold for every ticket — the toast only has its `onUndo`, not its
 * ticket. A ticket whose toast is not the held one lives a little longer than its
 * toast, never shorter, so no toast offers an undo its ticket would refuse.
 */
export function holdUndoWindows(): () => void {
  if (activeHolds === 0) {
    heldSince = Date.now();
  }
  activeHolds += 1;

  let released = false;

  return () => {
    if (released) {
      return;
    }
    released = true;
    activeHolds -= 1;

    if (activeHolds === 0) {
      heldBeforeMs += Date.now() - heldSince;
    }
  };
}

/**
 * A ticket good for one undo, valid for `ttlMs` (default {@link UNDO_WINDOW_MS})
 * of un-held time from creation ({@link holdUndoWindows}).
 * Calling `undo()` after it expires never runs the underlying action; it
 * returns the 'expired' error instead.
 */
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? UNDO_WINDOW_MS;
  const deadline = now() + ttlMs;
  const heldAtCreation = heldMs();
  const expiresAt = (): number => deadline + heldMs() - heldAtCreation;
  let used = false;

  const getStatus = (): UndoTicketStatus => {
    if (used) {
      return 'used';
    }

    return now() >= expiresAt() ? 'expired' : 'active';
  };

  const undo = (): Result<void, UndoTicketError> => {
    if (getStatus() !== 'active') {
      return { error: 'expired', ok: false };
    }

    used = true;
    options.undo();

    return { data: undefined, ok: true };
  };

  return {
    description: options.description,
    get expiresAt() {
      return expiresAt();
    },
    getStatus,
    id: createUuid(),
    undo,
  };
}

/**
 * Runs `run` after `windowMs` (default {@link UNDO_WINDOW_MS}) of un-held time —
 * the timer that goes with a ticket. A plain `setTimeout` for the same eight
 * seconds would act while a held toast still offers "Hoàn tác" and its ticket
 * still says yes: a session revoked, a notification marked read, a toast pulled
 * out from under the pointer (BUG-571). Returns a cancel.
 *
 * ponytail: re-checks at the remaining time while held; a hold that starts in the
 * window's last milliseconds re-checks that often until it is released.
 */
export function afterUndoWindow(run: () => void, windowMs: number = UNDO_WINDOW_MS): () => void {
  const startedAt = Date.now();
  const heldAtStart = heldMs();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const arm = (delayMs: number): void => {
    timer = setTimeout(() => {
      const left = windowMs - (Date.now() - startedAt - (heldMs() - heldAtStart));

      if (left > 0) {
        arm(left);
        return;
      }

      run();
    }, delayMs);
  };

  arm(windowMs);

  return () => clearTimeout(timer);
}

export interface CombineUndoTicketsOptions {
  /** Vietnamese sentence naming the whole group, e.g. `Hoàn tác 3 thay đổi`. */
  description: string;
  now?: () => number;
}

/**
 * One ticket standing for several, and it keeps the promises all of them made.
 *
 * Built here rather than out of {@link createUndoTicket} because a group needs
 * two things a single ticket does not, and both are what A8 turns on:
 *
 * - **It expires when the first of its children does.** A fresh window counted
 *   from the moment of grouping outlives them: publish A at t=0 and B at
 *   t=4.900 and a default group ran to t=12.900, toast and all, while A's own
 *   ticket had died at t=8.000.
 * - **A child that refuses fails the group.** `createUndoTicket` takes an
 *   `undo` that cannot report anything, so wrapping a loop in one threw every
 *   child's `Result` away: pressing Undo at t=12.000 took back B, silently
 *   failed on A, and answered `ok`. Change A was never undone and nothing said
 *   so.
 *
 * `undefined` for an empty list, and the ticket itself for a list of one: there
 * is nothing to combine, and a wrapper would only shorten its life.
 */
export function combineUndoTickets(
  tickets: readonly UndoTicket[],
  options: CombineUndoTicketsOptions,
): UndoTicket | undefined {
  const first = tickets[0];

  if (first === undefined) {
    return undefined;
  }

  if (tickets.length === 1) {
    return first;
  }

  const now = options.now ?? Date.now;
  // Read each time: a hold moves every child's end, and the group's with them.
  const expiresAt = (): number =>
    tickets.reduce((earliest, ticket) => Math.min(earliest, ticket.expiresAt), first.expiresAt);
  let used = false;

  const getStatus = (): UndoTicketStatus => {
    if (used) {
      return 'used';
    }

    return now() >= expiresAt() ? 'expired' : 'active';
  };

  const undo = (): Result<void, UndoTicketError> => {
    if (getStatus() !== 'active') {
      return { error: 'expired', ok: false };
    }

    used = true;

    // Newest first, the order a person undoes in. Every child is attempted even
    // after one refuses — stopping half-way would leave the drawing in a state
    // nobody asked for — and the first refusal is what comes back.
    const failure = [...tickets]
      .reverse()
      .map((ticket) => ticket.undo())
      .find((outcome) => !outcome.ok);

    return failure ?? { data: undefined, ok: true };
  };

  return {
    description: options.description,
    get expiresAt() {
      return expiresAt();
    },
    getStatus,
    id: createUuid(),
    undo,
  };
}
