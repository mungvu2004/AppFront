import { coalesce, COALESCE_WINDOW_MS, type Command, type CoalescedCommand } from './coalesce';

const DEFAULT_MAX_QUEUE_SIZE = 20;

export interface CreateFlushPolicyOptions<TValue> {
  idleMs?: number;
  maxQueueSize?: number;
  onFlush: (commands: readonly CoalescedCommand<TValue>[]) => void;
  windowMs?: number;
}

export interface FlushPolicy<TValue> {
  changeFloor: () => void;
  enqueue: (command: Command<TValue>) => void;
  flush: () => void;
}

/**
 * Buffers commands instead of sending each one to the server, and decides
 * when to flush the buffer (coalesced via `coalesce`) to `onFlush`: after
 * `idleMs` of silence, once `maxQueueSize` commands have queued up, as soon
 * as a command arrives that cannot join the buffered run, or whenever
 * `changeFloor` is called.
 */
export function createFlushPolicy<TValue>(options: CreateFlushPolicyOptions<TValue>): FlushPolicy<TValue> {
  const idleMs = options.idleMs ?? COALESCE_WINDOW_MS;
  const windowMs = options.windowMs ?? COALESCE_WINDOW_MS;
  const maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;

  let buffer: Command<TValue>[] = [];
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const clearIdleTimer = (): void => {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
  };

  const flush = (): void => {
    clearIdleTimer();

    if (buffer.length === 0) {
      return;
    }

    const commands = buffer;
    buffer = [];
    options.onFlush(coalesce(commands, windowMs));
  };

  const scheduleIdleFlush = (): void => {
    clearIdleTimer();
    idleTimer = setTimeout(flush, idleMs);
  };

  const canJoinBuffer = (command: Command<TValue>): boolean => {
    const last = buffer[buffer.length - 1];

    return last !== undefined && last.kind === command.kind && last.targetId === command.targetId;
  };

  const enqueue = (command: Command<TValue>): void => {
    if (buffer.length > 0 && !canJoinBuffer(command)) {
      flush();
    }

    buffer.push(command);

    if (buffer.length >= maxQueueSize) {
      flush();
      return;
    }

    scheduleIdleFlush();
  };

  const changeFloor = (): void => {
    flush();
  };

  return { changeFloor, enqueue, flush };
}
