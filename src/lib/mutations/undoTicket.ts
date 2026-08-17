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
  expiresAt: number;
  getStatus: () => UndoTicketStatus;
  id: string;
  undo: () => Result<void, UndoTicketError>;
}

/**
 * A ticket good for one undo, valid for `ttlMs` (default {@link UNDO_WINDOW_MS})
 * from creation.
 * Calling `undo()` after it expires never runs the underlying action; it
 * returns the 'expired' error instead.
 */
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? UNDO_WINDOW_MS;
  const expiresAt = now() + ttlMs;
  let used = false;

  const getStatus = (): UndoTicketStatus => {
    if (used) {
      return 'used';
    }

    return now() >= expiresAt ? 'expired' : 'active';
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
    expiresAt,
    getStatus,
    id: createUuid(),
    undo,
  };
}
