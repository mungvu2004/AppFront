import { describe, expect, it } from 'vitest';

import type { BoundingBox, FurnitureId, LevelId, Point } from '@/domain/spatial/types';
import { OPENING_COMMAND_TYPES } from '@/lib/commands/business/openingCommands';

import { cursorFor, CURSOR_CSS, cursorCssFor, TOOL_CURSORS } from '../cursors';
import {
  boxAround,
  dragEventForKey,
  dragGhost,
  dragStatusText,
  IDLE_DRAG_STATE,
  KEYBOARD_STEP_MM,
  reduceDragDrop,
  snapToStepMm,
  type DragDropDeps,
  type DragDropState,
  type DragLibraryItem,
} from '../dragDrop';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const LEVEL_ID: LevelId = 'L-TEST01';

const TABLE_ITEM: DragLibraryItem = {
  kind: 'table',
  widthMm: 1200,
  depthMm: 700,
  label: 'bàn làm việc',
};

/** Drops with a centre inside this box are refused by the test validator. */
const FORBIDDEN_ZONE: BoundingBox = { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } };

const BLOCK_REASON = 'Vị trí thả nằm trong vùng cấm.';

const insideForbiddenZone = (point: Point): boolean =>
  point.x >= FORBIDDEN_ZONE.min.x &&
  point.x <= FORBIDDEN_ZONE.max.x &&
  point.y >= FORBIDDEN_ZONE.min.y &&
  point.y <= FORBIDDEN_ZONE.max.y;

interface TestDeps extends DragDropDeps {
  readonly mintedIds: readonly FurnitureId[];
}

const createDeps = (): TestDeps => {
  const mintedIds: FurnitureId[] = [];

  return {
    levelId: LEVEL_ID,
    mintedIds,
    nextId: (): FurnitureId => {
      const id: FurnitureId = `F-TEST${mintedIds.length + 1}`;

      mintedIds.push(id);

      return id;
    },
    validateDrop: (input) => (insideForbiddenZone(input.centre) ? [BLOCK_REASON] : []),
  };
};

const startPointerDrag = (
  deps: TestDeps,
  at: Point,
): DragDropState =>
  reduceDragDrop(IDLE_DRAG_STATE, { type: 'start', item: TABLE_ITEM, at, mode: 'pointer' }, deps)
    .state;

const startKeyboardDrag = (deps: TestDeps, at: Point): DragDropState =>
  reduceDragDrop(IDLE_DRAG_STATE, { type: 'start', item: TABLE_ITEM, at, mode: 'keyboard' }, deps)
    .state;

/* -------------------------------------------------------------------------- */
/* The session.                                                                */
/* -------------------------------------------------------------------------- */

describe('reduceDragDrop', () => {
  it('mints one id at pickup and keeps it for the whole session', () => {
    const deps = createDeps();

    let state = startPointerDrag(deps, { x: 2000, y: 2000 });

    state = reduceDragDrop(state, { type: 'move', at: { x: 2100, y: 2000 } }, deps).state;
    state = reduceDragDrop(state, { type: 'move', at: { x: 2200, y: 2000 } }, deps).state;

    expect(deps.mintedIds).toHaveLength(1);

    const { request } = reduceDragDrop(state, { type: 'drop' }, deps);

    expect(request?.input.id).toBe(deps.mintedIds[0]);
  });

  it('reports an illegal spot during the drag, not at the release', () => {
    const deps = createDeps();

    let state = startPointerDrag(deps, { x: 2000, y: 2000 });

    expect(state.phase === 'dragging' && state.session.dropAllowed).toBe(true);

    state = reduceDragDrop(state, { type: 'move', at: { x: 500, y: 500 } }, deps).state;

    if (state.phase !== 'dragging') {
      throw new Error('expected the session to survive a move');
    }

    expect(state.session.dropAllowed).toBe(false);
    expect(state.session.blockReasons).toEqual([BLOCK_REASON]);
  });

  it('emits exactly one command on a successful drop', () => {
    const deps = createDeps();
    const state = startPointerDrag(deps, { x: 2000, y: 3000 });

    const dropped = reduceDragDrop(state, { type: 'drop' }, deps);

    expect(dropped.request).toEqual({
      type: OPENING_COMMAND_TYPES.addFurniture,
      input: {
        id: deps.mintedIds[0],
        levelId: LEVEL_ID,
        kind: 'table',
        centre: { x: 2000, y: 3000 },
        boundingBox: boxAround({ x: 2000, y: 3000 }, 1200, 700),
        rotationDeg: 0,
      },
    });
    expect(dropped.state).toEqual(IDLE_DRAG_STATE);

    const droppedAgain = reduceDragDrop(dropped.state, { type: 'drop' }, deps);

    expect(droppedAgain.request).toBeNull();
  });

  it('emits nothing when the drop point is illegal', () => {
    const deps = createDeps();
    const state = startPointerDrag(deps, { x: 500, y: 500 });

    const dropped = reduceDragDrop(state, { type: 'drop' }, deps);

    expect(dropped.request).toBeNull();
    expect(dropped.state).toEqual(IDLE_DRAG_STATE);
  });

  it('keeps a keyboard session alive after a refused drop', () => {
    const deps = createDeps();
    const state = startKeyboardDrag(deps, { x: 500, y: 500 });

    const dropped = reduceDragDrop(state, { type: 'drop' }, deps);

    expect(dropped.request).toBeNull();
    expect(dropped.state.phase).toBe('dragging');
  });

  it('cancel ends the session and emits nothing', () => {
    const deps = createDeps();
    const state = startPointerDrag(deps, { x: 2000, y: 2000 });

    const cancelled = reduceDragDrop(state, { type: 'cancel' }, deps);

    expect(cancelled.state).toEqual(IDLE_DRAG_STATE);
    expect(cancelled.request).toBeNull();
  });

  it('ignores moves, nudges and drops while idle', () => {
    const deps = createDeps();

    expect(reduceDragDrop(IDLE_DRAG_STATE, { type: 'move', at: { x: 1, y: 1 } }, deps).state).toBe(
      IDLE_DRAG_STATE,
    );
    expect(
      reduceDragDrop(IDLE_DRAG_STATE, { type: 'nudge', direction: 'left' }, deps).state,
    ).toBe(IDLE_DRAG_STATE);
    expect(reduceDragDrop(IDLE_DRAG_STATE, { type: 'drop' }, deps).request).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The keyboard flow.                                                          */
/* -------------------------------------------------------------------------- */

describe('keyboard drag', () => {
  it('snaps the pickup to the step grid', () => {
    const deps = createDeps();
    const state = startKeyboardDrag(deps, { x: 1234, y: 567 });

    if (state.phase !== 'dragging') {
      throw new Error('expected a live session');
    }

    expect(state.session.centre).toEqual({ x: 1250, y: 550 });
  });

  it('carries the item in 50 mm steps and sets it down on the grid', () => {
    const deps = createDeps();

    let state = startKeyboardDrag(deps, { x: 1234, y: 567 });

    state = reduceDragDrop(state, { type: 'nudge', direction: 'right' }, deps).state;
    state = reduceDragDrop(state, { type: 'nudge', direction: 'right' }, deps).state;
    state = reduceDragDrop(state, { type: 'nudge', direction: 'down' }, deps).state;

    const dropped = reduceDragDrop(state, { type: 'drop' }, deps);

    expect(dropped.request?.input.centre).toEqual({ x: 1350, y: 600 });
    expect((dropped.request?.input.centre.x ?? 1) % KEYBOARD_STEP_MM).toBe(0);
    expect((dropped.request?.input.centre.y ?? 1) % KEYBOARD_STEP_MM).toBe(0);
  });

  it('maps the keys the drag owns and nothing else', () => {
    expect(dragEventForKey('Enter')).toEqual({ type: 'drop' });
    expect(dragEventForKey('Escape')).toEqual({ type: 'cancel' });
    expect(dragEventForKey('ArrowLeft')).toEqual({ type: 'nudge', direction: 'left' });
    expect(dragEventForKey('ArrowRight')).toEqual({ type: 'nudge', direction: 'right' });
    expect(dragEventForKey('ArrowUp')).toEqual({ type: 'nudge', direction: 'up' });
    expect(dragEventForKey('ArrowDown')).toEqual({ type: 'nudge', direction: 'down' });
    expect(dragEventForKey('a')).toBeNull();
    expect(dragEventForKey('Tab')).toBeNull();
  });

  it('rounds half steps away from the lower multiple consistently', () => {
    expect(snapToStepMm(24)).toBe(0);
    expect(snapToStepMm(26)).toBe(50);
    expect(snapToStepMm(-26)).toBe(-50);
    expect(snapToStepMm(130, 100)).toBe(100);
  });
});

/* -------------------------------------------------------------------------- */
/* What the interface reads.                                                   */
/* -------------------------------------------------------------------------- */

describe('dragGhost and dragStatusText', () => {
  it('shows a furniture ghost that follows the session', () => {
    const deps = createDeps();
    const state = startPointerDrag(deps, { x: 2000, y: 2000 });

    expect(dragGhost(state)).toEqual({
      kind: 'furnitureGhost',
      centre: { x: 2000, y: 2000 },
      boundingBox: boxAround({ x: 2000, y: 2000 }, 1200, 700),
      furnitureKind: 'table',
      rotationDeg: 0,
    });
    expect(dragGhost(IDLE_DRAG_STATE)).toBeNull();
  });

  it('speaks the verdict for the current spot', () => {
    const deps = createDeps();

    const legal = startPointerDrag(deps, { x: 2000, y: 2000 });

    expect(dragStatusText(legal)).toContain('thả được');
    expect(dragStatusText(legal)).toContain(TABLE_ITEM.label);

    const illegal = startPointerDrag(deps, { x: 500, y: 500 });

    expect(dragStatusText(illegal)).toContain('không thả được');
    expect(dragStatusText(illegal)).toContain(BLOCK_REASON);

    expect(dragStatusText(IDLE_DRAG_STATE)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* The cursor table.                                                           */
/* -------------------------------------------------------------------------- */

describe('cursorFor', () => {
  it('rests on the tool base cursor when nothing is happening', () => {
    expect(cursorFor({ tool: 'select' })).toBe('select');
    expect(cursorFor({ tool: 'pan' })).toBe('pan');
    expect(cursorFor({ tool: 'drawWall' })).toBe('draw');
    expect(cursorFor({ tool: 'placeFurniture' })).toBe('draw');
  });

  it('covers every tool with a base cursor', () => {
    for (const kind of Object.values(TOOL_CURSORS)) {
      expect(CURSOR_CSS[kind]).toBeTruthy();
    }
  });

  it('shows forbidden over an illegal drop point while dragging', () => {
    expect(cursorFor({ tool: 'select', dragging: true, dropAllowed: false })).toBe('forbidden');
    expect(cursorFor({ tool: 'select', dragging: true, dropAllowed: true })).toBe('dragging');
  });

  it('prefers the drag over the armed pan, and the armed pan over hover', () => {
    expect(
      cursorFor({ tool: 'select', dragging: true, panningViewport: true, overDraggable: true }),
    ).toBe('dragging');
    expect(cursorFor({ tool: 'select', panningViewport: true, overDraggable: true })).toBe('pan');
    expect(cursorFor({ tool: 'select', overDraggable: true })).toBe('draggable');
  });

  it('arms the zoom cursor above the pan override', () => {
    expect(cursorFor({ tool: 'select', zooming: true, panningViewport: true })).toBe('zoom');
  });

  it('maps kinds onto CSS values', () => {
    expect(cursorCssFor({ tool: 'select', dragging: true, dropAllowed: false })).toBe(
      'not-allowed',
    );
    expect(CURSOR_CSS.dragging).toBe('grabbing');
    expect(CURSOR_CSS.draggable).toBe('grab');
  });
});
