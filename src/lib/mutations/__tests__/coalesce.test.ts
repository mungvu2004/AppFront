import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { coalesce, COALESCE_WINDOW_MS, type Command } from '../coalesce';
import { createFlushPolicy } from '../flushPolicy';

interface Point {
  x: number;
  y: number;
}

const wallDrag = (targetId: string, timestamp: number, previousValue: Point, value: Point): Command<Point> => ({
  kind: 'editWall',
  previousValue,
  targetId,
  timestamp,
  value,
});

describe('coalesce', () => {
  it('merges same-kind, same-target commands inside the window into the first previousValue and the last value', () => {
    const commands: Command<Point>[] = [
      wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }),
      wallDrag('wall-1', 100, { x: 1, y: 0 }, { x: 2, y: 0 }),
      wallDrag('wall-1', 200, { x: 2, y: 0 }, { x: 3, y: 0 }),
    ];

    const result = coalesce(commands);

    expect(result).toEqual([
      {
        kind: 'editWall',
        mergedCount: 3,
        previousValue: { x: 0, y: 0 },
        targetId: 'wall-1',
        timestamp: 200,
        value: { x: 3, y: 0 },
      },
    ]);
  });

  it('coalesces 30 wall-drag commands spread across ~1 second into at most 3 commands', () => {
    const commands: Command<Point>[] = Array.from({ length: 30 }, (_, index) =>
      wallDrag('wall-1', index * 33, { x: index, y: 0 }, { x: index + 1, y: 0 }),
    );

    const result = coalesce(commands);

    expect(result.length).toBeLessThanOrEqual(3);
    expect(result[0]?.previousValue).toEqual({ x: 0, y: 0 });
    expect(result[result.length - 1]?.value).toEqual({ x: 30, y: 0 });
  });

  it('undoing a coalesced command (applying its previousValue) restores the exact coordinates before the first command', () => {
    const commands: Command<Point>[] = [
      wallDrag('wall-1', 0, { x: 10, y: 10 }, { x: 12, y: 10 }),
      wallDrag('wall-1', 50, { x: 12, y: 10 }, { x: 18, y: 11 }),
      wallDrag('wall-1', 100, { x: 18, y: 11 }, { x: 25, y: 13 }),
    ];

    const [merged] = coalesce(commands);

    expect(merged?.previousValue).toEqual({ x: 10, y: 10 });
  });

  it('starts a new run once the gap reaches the window (boundary is exclusive)', () => {
    const commands: Command<Point>[] = [
      wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }),
      wallDrag('wall-1', COALESCE_WINDOW_MS, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ];

    const result = coalesce(commands);

    expect(result).toHaveLength(2);
    expect(result[0]?.mergedCount).toBe(1);
    expect(result[1]?.mergedCount).toBe(1);
  });

  it('does not merge a delete command with an edit command on the same target', () => {
    const commands: Command<Point>[] = [
      wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }),
      { kind: 'deleteWall', previousValue: { x: 1, y: 0 }, targetId: 'wall-1', timestamp: 50, value: { x: 1, y: 0 } },
    ];

    const result = coalesce(commands);

    expect(result).toHaveLength(2);
    expect(result[0]?.kind).toBe('editWall');
    expect(result[1]?.kind).toBe('deleteWall');
  });

  it('does not merge commands for different targets even when close in time', () => {
    const commands: Command<Point>[] = [
      wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }),
      wallDrag('wall-2', 10, { x: 5, y: 5 }, { x: 6, y: 5 }),
    ];

    const result = coalesce(commands);

    expect(result).toHaveLength(2);
  });

  it('accepts a custom window', () => {
    const commands: Command<Point>[] = [
      wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }),
      wallDrag('wall-1', 900, { x: 1, y: 0 }, { x: 2, y: 0 }),
    ];

    expect(coalesce(commands, 1000)).toHaveLength(1);
    expect(coalesce(commands, 400)).toHaveLength(2);
  });
});

describe('createFlushPolicy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes after the queue has been silent for idleMs', () => {
    const onFlush = vi.fn();
    const policy = createFlushPolicy<Point>({ onFlush });

    policy.enqueue(wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }));
    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(COALESCE_WINDOW_MS);

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([
      expect.objectContaining({ mergedCount: 1, previousValue: { x: 0, y: 0 }, value: { x: 1, y: 0 } }),
    ]);
  });

  it('flushes as soon as the queue reaches maxQueueSize, then keeps buffering the rest', () => {
    const onFlush = vi.fn();
    const policy = createFlushPolicy<Point>({ maxQueueSize: 20, onFlush });

    for (let index = 0; index < 30; index += 1) {
      policy.enqueue(wallDrag('wall-1', index * 10, { x: index, y: 0 }, { x: index + 1, y: 0 }));
    }

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0]?.[0]).toEqual([expect.objectContaining({ mergedCount: 20 })]);

    vi.advanceTimersByTime(COALESCE_WINDOW_MS);

    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush.mock.calls[1]?.[0]).toEqual([expect.objectContaining({ mergedCount: 10 })]);
  });

  it('flushes immediately when a command that cannot join the buffered run arrives', () => {
    const onFlush = vi.fn();
    const policy = createFlushPolicy<Point>({ onFlush });

    policy.enqueue(wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }));
    policy.enqueue(wallDrag('wall-1', 10, { x: 1, y: 0 }, { x: 2, y: 0 }));
    policy.enqueue({ kind: 'deleteWall', previousValue: { x: 2, y: 0 }, targetId: 'wall-1', timestamp: 20, value: { x: 2, y: 0 } });

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0]?.[0]).toEqual([expect.objectContaining({ kind: 'editWall', mergedCount: 2 })]);
  });

  it('flushes on changeFloor even before the idle window elapses', () => {
    const onFlush = vi.fn();
    const policy = createFlushPolicy<Point>({ onFlush });

    policy.enqueue(wallDrag('wall-1', 0, { x: 0, y: 0 }, { x: 1, y: 0 }));
    policy.changeFloor();

    expect(onFlush).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(COALESCE_WINDOW_MS);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('does nothing on changeFloor when the queue is empty', () => {
    const onFlush = vi.fn();
    const policy = createFlushPolicy<Point>({ onFlush });

    policy.changeFloor();

    expect(onFlush).not.toHaveBeenCalled();
  });
});
