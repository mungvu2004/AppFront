import { createUuid } from '@/lib/http/ids';
import type { Result } from '@/lib/http/types';

const DEFAULT_TTL_MS = 8000;

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
 * A ticket good for one undo, valid for `ttlMs` (default 8000ms) from creation.
 * Calling `undo()` after it expires never runs the underlying action; it
 * returns the 'expired' error instead.
 */
export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
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
