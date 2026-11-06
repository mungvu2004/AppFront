import { describe, expect, it } from 'vitest';

import { coalesce, COALESCE_WINDOW_MS, type Command } from '../coalesce';

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
