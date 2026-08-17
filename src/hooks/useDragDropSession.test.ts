import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FurnitureId, LevelId, Point } from '@/domain/spatial/types';
import type { DragDropDeps, DragLibraryItem } from '@/lib/input/dragDrop';

import { useDragDropSession } from './useDragDropSession';

const LEVEL_ID: LevelId = 'L-TEST01';

const TABLE_ITEM: DragLibraryItem = {
  kind: 'table',
  widthMm: 1200,
  depthMm: 700,
  label: 'bàn làm việc',
};

/** The test validator refuses any centre with x below 1000. */
const BLOCK_REASON = 'Vị trí thả nằm trong vùng cấm.';

const createDeps = (): DragDropDeps => {
  let minted = 0;

  return {
    levelId: LEVEL_ID,
    nextId: (): FurnitureId => `F-TEST${(minted += 1)}`,
    validateDrop: (input) => (input.centre.x < 1000 ? [BLOCK_REASON] : []),
  };
};

const mountSession = () => {
  const onDrop = vi.fn();
  const announcer = { announce: vi.fn(), destroy: vi.fn() };
  const hook = renderHook(() =>
    useDragDropSession({ deps: createDeps(), onDrop, announcer }),
  );

  return { onDrop, announcer, hook };
};

const LEGAL_SPOT: Point = { x: 2000, y: 2000 };
const ILLEGAL_SPOT: Point = { x: 500, y: 500 };

describe('useDragDropSession', () => {
  it('picks an item up, shows a ghost and announces the verdict politely', () => {
    const { announcer, hook } = mountSession();

    act(() => hook.result.current.pickUp(TABLE_ITEM, LEGAL_SPOT));

    expect(hook.result.current.state.phase).toBe('dragging');
    expect(hook.result.current.ghost?.kind).toBe('furnitureGhost');
    expect(announcer.announce).toHaveBeenCalledWith(
      expect.stringContaining('thả được'),
      'polite',
    );
  });

  it('announces an illegal spot assertively while still dragging', () => {
    const { announcer, hook } = mountSession();

    act(() => hook.result.current.pickUp(TABLE_ITEM, LEGAL_SPOT));
    act(() => hook.result.current.moveTo(ILLEGAL_SPOT));

    expect(hook.result.current.state.phase).toBe('dragging');
    expect(announcer.announce).toHaveBeenLastCalledWith(
      expect.stringContaining(BLOCK_REASON),
      'assertive',
    );
  });

  it('hands the one command to onDrop and announces the placement', () => {
    const { onDrop, announcer, hook } = mountSession();

    act(() => hook.result.current.pickUp(TABLE_ITEM, LEGAL_SPOT));
    act(() => hook.result.current.drop());

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0]?.[0]?.input.centre).toEqual(LEGAL_SPOT);
    expect(hook.result.current.state.phase).toBe('idle');
    expect(announcer.announce).toHaveBeenLastCalledWith(
      expect.stringContaining('đã đặt bàn làm việc'),
    );
  });

  it('emits nothing when the pointer releases over an illegal spot', () => {
    const { onDrop, hook } = mountSession();

    act(() => hook.result.current.pickUp(TABLE_ITEM, ILLEGAL_SPOT));
    act(() => hook.result.current.drop());

    expect(onDrop).not.toHaveBeenCalled();
    expect(hook.result.current.state.phase).toBe('idle');
  });

  it('steers a keyboard session with the arrow keys and sets down on the grid', () => {
    const { onDrop, hook } = mountSession();

    act(() => hook.result.current.pickUp(TABLE_ITEM, { x: 1234, y: 567 }, 'keyboard'));

    const pressed: boolean[] = [];

    act(() => {
      pressed.push(hook.result.current.handleKeyDown({ key: 'ArrowRight' }));
    });
    act(() => {
      pressed.push(hook.result.current.handleKeyDown({ key: 'ArrowDown' }));
    });
    act(() => {
      pressed.push(hook.result.current.handleKeyDown({ key: 'Enter' }));
    });

    expect(pressed).toEqual([true, true, true]);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0]?.[0]?.input.centre).toEqual({ x: 1300, y: 600 });
  });

  it('stops the propagation of the keys it consumes', () => {
    const { hook } = mountSession();

    act(() => hook.result.current.pickUp(TABLE_ITEM, LEGAL_SPOT, 'keyboard'));

    const event = { key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() };

    act(() => {
      hook.result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.phase).toBe('idle');
  });

  it('ignores keys while idle and keys the drag does not own', () => {
    const { hook } = mountSession();

    expect(hook.result.current.handleKeyDown({ key: 'Enter' })).toBe(false);

    act(() => hook.result.current.pickUp(TABLE_ITEM, LEGAL_SPOT, 'keyboard'));

    expect(hook.result.current.handleKeyDown({ key: 'a' })).toBe(false);
  });

  it('answers the cursor for the canvas from the session verdict', () => {
    const { hook } = mountSession();

    expect(hook.result.current.cursorCss('placeFurniture')).toBe('crosshair');

    act(() => hook.result.current.pickUp(TABLE_ITEM, LEGAL_SPOT));

    expect(hook.result.current.cursorCss('placeFurniture')).toBe('grabbing');

    act(() => hook.result.current.moveTo(ILLEGAL_SPOT));

    expect(hook.result.current.cursorCss('placeFurniture')).toBe('not-allowed');
  });
});
