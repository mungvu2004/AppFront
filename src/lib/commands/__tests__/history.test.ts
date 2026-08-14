import { describe, expect, it } from 'vitest';

import { applyPatch } from '@/domain/spatial/applyPatch';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, Level, Room, SpatialGraph, Wall } from '@/domain/spatial/types';
import { changeForRemove, changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import type { UndoEntry, UndoEntryId } from '@/lib/commands/dispatch';
import {
  buildHistoryLabel,
  createHistoryStack,
  MAX_HISTORY_STEPS,
  NO_SELECTION,
  type HistoryPushInput,
  type SelectionSnapshot,
} from '@/lib/commands/history';
import { commandToPatches, invertCommand } from '@/lib/commands/invert';
import { canMergeCommands, mergeCommands, mergeCommandRun, MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import type { Command } from '@/lib/commands/types';

/* -------------------------------------------------------------------------- */
/* Fixtures — the standard sample floor.                                       */
/* -------------------------------------------------------------------------- */

const LEVEL_ID = 'L-000001AAAA' as const;
const WALL_ID = 'W-000014AAAA' as const;
const OTHER_WALL_ID = 'W-000015AAAA' as const;
const ROOM_ID = 'R-000001AAAA' as const;

const levelFixture: Level = {
  id: LEVEL_ID,
  name: 'Tầng 1',
  order: 0,
  elevationMm: 0,
  heightMm: 3400,
  areaM2: 248.6,
  confidence: 0.95,
  source: 'human',
  reviewed: true,
};

const wallFixture: Wall = {
  id: WALL_ID,
  levelId: LEVEL_ID,
  centreline: { start: { x: 0, y: 0 }, end: { x: 4800, y: 0 } },
  thicknessMm: 220,
  heightMm: 3400,
  kind: 'loadBearing',
  openingIds: [],
  confidence: 0.92,
  source: 'ai',
  reviewed: false,
};

const otherWallFixture: Wall = {
  ...wallFixture,
  id: OTHER_WALL_ID,
  centreline: { start: { x: 4800, y: 0 }, end: { x: 4800, y: 3600 } },
};

const roomFixture: Room = {
  id: ROOM_ID,
  levelId: LEVEL_ID,
  name: 'Phòng khách',
  usage: 'livingRoom',
  outline: [
    { x: 0, y: 0 },
    { x: 4800, y: 0 },
    { x: 4800, y: 3600 },
    { x: 0, y: 3600 },
  ],
  areaM2: 17.28,
  wallIds: [WALL_ID],
  confidence: 0.9,
  source: 'ai',
  reviewed: false,
};

const furnitureFixture = (index: number): Furniture => ({
  id: `F-00000${index}AAAA`,
  levelId: LEVEL_ID,
  kind: 'chair',
  centre: { x: 1000 * index, y: 1000 },
  boundingBox: { min: { x: 1000 * index - 250, y: 750 }, max: { x: 1000 * index + 250, y: 1250 } },
  rotationDeg: 0,
  confidence: 0.9,
  source: 'ai',
  reviewed: false,
});

const sampleGraph: SpatialGraph = {
  building: {
    name: 'Nhà phố mẫu',
    datumElevationMm: 0,
    grossFloorAreaM2: 248.6,
    confidence: 1,
    source: 'human',
    reviewed: true,
  },
  levels: [levelFixture],
  walls: [wallFixture, otherWallFixture],
  openings: [],
  furniture: [furnitureFixture(1), furnitureFixture(2), furnitureFixture(3)],
  rooms: [roomFixture],
  axes: [],
  dimensions: [],
  notes: [],
};

const createGraph = (): NormalizedSpatial => normalizeSpatial(sampleGraph);

/* -------------------------------------------------------------------------- */
/* Commands and entries, shaped exactly as the pipeline publishes them.        */
/* -------------------------------------------------------------------------- */

const BASE_MS = Date.parse('2026-08-14T10:00:00.000Z');

const isoAt = (offsetMs: number): string => new Date(BASE_MS + offsetMs).toISOString();

let commandCounter = 0;

const nextCommandId = (): `C-${string}` => {
  commandCounter += 1;

  return `C-${String(commandCounter).padStart(6, '0')}AAAA`;
};

interface DragOptions {
  readonly fromMm: number;
  readonly toMm: number;
  readonly atMs: number;
  readonly wall?: Wall;
  readonly type?: string;
  readonly actorId?: string;
}

/** One frame of a wall drag: the wall as it was, and as it now is. */
const dragCommand = (options: DragOptions): Command => {
  const wall = options.wall ?? wallFixture;

  return createCommand({
    type: options.type ?? 'wall.move',
    actorId: options.actorId ?? 'user-01',
    description: 'Kéo tường',
    changes: [
      changeForUpdate(
        'wall',
        { ...wall, thicknessMm: options.fromMm },
        { ...wall, thicknessMm: options.toMm },
      ),
    ],
    id: nextCommandId(),
    timestamp: isoAt(options.atMs),
  });
};

const removeFurnitureCommand = (): Command =>
  createCommand({
    type: 'furniture.remove',
    actorId: 'user-01',
    description: 'Xoá đồ đạc đã chọn',
    changes: [1, 2, 3].map((index) => changeForRemove('furniture', furnitureFixture(index))),
    id: nextCommandId(),
    timestamp: isoAt(0),
  });

/** The entry the pipeline publishes for a batch of commands. */
const entryOf = (commands: readonly Command[], label: string): UndoEntry => ({
  id: `U-${String(commands[0]?.id ?? 'C-000000AAAA').slice(2)}` as UndoEntryId,
  label,
  commands,
  timestamp: commands[commands.length - 1]?.timestamp ?? isoAt(0),
  undoPatches: [...commands].reverse().flatMap((command) => commandToPatches(invertCommand(command))),
});

const pushOf = (
  commands: readonly Command[],
  selectionBefore: SelectionSnapshot = NO_SELECTION,
  selectionAfter: SelectionSnapshot = NO_SELECTION,
): HistoryPushInput => ({
  entry: entryOf(commands, commands[0]?.description ?? 'Thay đổi'),
  selectionBefore,
  selectionAfter,
});

/** Graph and selection together — the state undo has to bring back whole. */
interface DrawingState {
  readonly graph: NormalizedSpatial;
  readonly selection: SelectionSnapshot;
}

const applyForward = (state: DrawingState, command: Command, selection: SelectionSnapshot): DrawingState => ({
  graph: applyPatch(state.graph, commandToPatches(command)),
  selection,
});

/* -------------------------------------------------------------------------- */
/* Depth.                                                                      */
/* -------------------------------------------------------------------------- */

describe('createHistoryStack: chiều sâu', () => {
  it('keeps exactly 100 steps out of 120 commands, dropping the oldest', () => {
    const stack = createHistoryStack();
    const pushed: string[] = [];

    for (let index = 0; index < 120; index += 1) {
      // A full second apart, so nothing folds and every command is its own step.
      const command = dragCommand({ fromMm: 220 + index, toMm: 221 + index, atMs: index * 1000 });

      pushed.push(command.id);
      stack.push(pushOf([command]));
    }

    const steps = stack.undoSteps();

    expect(steps).toHaveLength(MAX_HISTORY_STEPS);
    expect(MAX_HISTORY_STEPS).toBe(100);
    // The 20 oldest fell off the bottom; the newest is still on top.
    expect(steps[0]?.commands[0]?.id).toBe(pushed[20]);
    expect(steps[steps.length - 1]?.commands[0]?.id).toBe(pushed[119]);
  });

  it('reports nothing to undo or redo when empty', () => {
    const stack = createHistoryStack();

    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Both directions.                                                            */
/* -------------------------------------------------------------------------- */

describe('createHistoryStack: hoàn tác và làm lại', () => {
  it('gives back the same drawing and the same selection after 5 undos and 5 redos', () => {
    const stack = createHistoryStack();
    const start: DrawingState = { graph: createGraph(), selection: { selectedIds: [ROOM_ID] } };

    let state = start;

    for (let index = 0; index < 5; index += 1) {
      const command = dragCommand({
        fromMm: 220 + index * 10,
        toMm: 230 + index * 10,
        atMs: index * 1000,
      });
      const selectionAfter: SelectionSnapshot = { selectedIds: index % 2 === 0 ? [WALL_ID] : [OTHER_WALL_ID] };

      stack.push(pushOf([command], state.selection, selectionAfter));
      state = applyForward(state, command, selectionAfter);
    }

    const afterEdits = state;

    for (let index = 0; index < 5; index += 1) {
      const transition = stack.undo();

      if (transition === null) {
        throw new Error('Còn bước mà không hoàn tác được.');
      }

      state = { graph: applyPatch(state.graph, transition.patches), selection: transition.selection };
    }

    expect(state.graph).toEqual(start.graph);
    expect(state.selection).toEqual(start.selection);
    expect(stack.canUndo()).toBe(false);

    for (let index = 0; index < 5; index += 1) {
      const transition = stack.redo();

      if (transition === null) {
        throw new Error('Còn bước mà không làm lại được.');
      }

      state = { graph: applyPatch(state.graph, transition.patches), selection: transition.selection };
    }

    expect(state.graph).toEqual(afterEdits.graph);
    expect(state.selection).toEqual(afterEdits.selection);
    expect(stack.canRedo()).toBe(false);
  });

  it('restores the selection an undone step was taken with', () => {
    const stack = createHistoryStack();
    const before: SelectionSnapshot = { selectedIds: [WALL_ID, OTHER_WALL_ID] };
    const after: SelectionSnapshot = { selectedIds: [] };

    stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })], before, after));

    expect(stack.undo()?.selection).toEqual(before);
    expect(stack.redo()?.selection).toEqual(after);
  });

  it('drops the redo branch as soon as a new command arrives', () => {
    const stack = createHistoryStack();

    stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 230, atMs: 0 })]));
    stack.push(pushOf([dragCommand({ fromMm: 230, toMm: 240, atMs: 1000 })]));
    stack.undo();

    expect(stack.canRedo()).toBe(true);
    expect(stack.redoSteps()).toHaveLength(1);

    stack.push(pushOf([dragCommand({ fromMm: 230, toMm: 300, atMs: 2000 })]));

    expect(stack.canRedo()).toBe(false);
    expect(stack.redoSteps()).toEqual([]);
    expect(stack.undoSteps()).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* One drag, one Ctrl+Z.                                                       */
/* -------------------------------------------------------------------------- */

describe('createHistoryStack: gộp một mạch kéo', () => {
  it('folds consecutive edits inside the window into one step', () => {
    const stack = createHistoryStack();
    const frames = [
      dragCommand({ fromMm: 220, toMm: 240, atMs: 0 }),
      dragCommand({ fromMm: 240, toMm: 260, atMs: 100 }),
      dragCommand({ fromMm: 260, toMm: 280, atMs: 200 }),
    ];

    let graph = createGraph();

    for (const frame of frames) {
      stack.push(pushOf([frame]));
      graph = applyPatch(graph, commandToPatches(frame));
    }

    const steps = stack.undoSteps();

    expect(steps).toHaveLength(1);
    expect(steps[0]?.entryIds).toHaveLength(3);
    // One press goes back to before the drag started, not one frame.
    expect(applyPatch(graph, steps[0]?.undoPatches ?? []).byId[WALL_ID]).toEqual(wallFixture);
    // And one press forward lands on where the drag ended.
    expect(applyPatch(createGraph(), steps[0]?.redoPatches ?? []).byId[WALL_ID]).toEqual({
      ...wallFixture,
      thicknessMm: 280,
    });
  });

  it('undoes a folded run in one press, back to the drawing and selection it started from', () => {
    const stack = createHistoryStack();
    const start: DrawingState = { graph: createGraph(), selection: { selectedIds: [ROOM_ID] } };

    let state = start;
    const frames = [
      dragCommand({ fromMm: 220, toMm: 240, atMs: 0 }),
      dragCommand({ fromMm: 240, toMm: 260, atMs: 100 }),
    ];

    for (const frame of frames) {
      const selectionAfter: SelectionSnapshot = { selectedIds: [WALL_ID] };

      stack.push(pushOf([frame], state.selection, selectionAfter));
      state = applyForward(state, frame, selectionAfter);
    }

    const transition = stack.undo();

    if (transition === null) {
      throw new Error('Không hoàn tác được mạch kéo.');
    }

    expect(applyPatch(state.graph, transition.patches)).toEqual(start.graph);
    expect(transition.selection).toEqual(start.selection);
    expect(stack.canUndo()).toBe(false);
  });

  it('closes the run at exactly the window, never merging beyond 400 ms', () => {
    const stack = createHistoryStack();

    expect(MERGE_WINDOW_MS).toBe(400);

    stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })]));
    stack.push(pushOf([dragCommand({ fromMm: 240, toMm: 260, atMs: 399 })]));

    expect(stack.undoSteps()).toHaveLength(1);

    stack.push(pushOf([dragCommand({ fromMm: 260, toMm: 280, atMs: 799 })]));

    expect(stack.undoSteps()).toHaveLength(2);

    // A gap of exactly the window belongs to the next run, not this one.
    stack.push(pushOf([dragCommand({ fromMm: 280, toMm: 300, atMs: 1199 })]));

    expect(stack.undoSteps()).toHaveLength(3);
  });

  it('never folds across a different entity, action or person', () => {
    const cases = [
      dragCommand({ fromMm: 220, toMm: 260, atMs: 100, wall: otherWallFixture }),
      dragCommand({ fromMm: 240, toMm: 260, atMs: 100, type: 'wall.resize' }),
      dragCommand({ fromMm: 240, toMm: 260, atMs: 100, actorId: 'user-02' }),
    ];

    for (const second of cases) {
      const stack = createHistoryStack();

      stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })]));
      stack.push(pushOf([second]));

      expect(stack.undoSteps()).toHaveLength(2);
    }
  });

  it('never folds a transaction, in either direction', () => {
    const stack = createHistoryStack();
    const grouped = [
      dragCommand({ fromMm: 220, toMm: 240, atMs: 0 }),
      dragCommand({ fromMm: 220, toMm: 240, atMs: 10, wall: otherWallFixture }),
    ];

    stack.push({
      entry: entryOf(grouped, 'Gộp 2 thay đổi'),
      selectionBefore: NO_SELECTION,
      selectionAfter: NO_SELECTION,
    });
    stack.push(pushOf([dragCommand({ fromMm: 240, toMm: 260, atMs: 20 })]));

    expect(stack.undoSteps()).toHaveLength(2);
    expect(stack.undoSteps()[0]?.label).toBe('Gộp 2 thay đổi');
  });
});

/* -------------------------------------------------------------------------- */
/* Taking an entry back off the top.                                           */
/* -------------------------------------------------------------------------- */

describe('createHistoryStack: gỡ mục vừa đẩy', () => {
  it('un-folds a run rather than dropping the whole thing', () => {
    const stack = createHistoryStack();
    const first = dragCommand({ fromMm: 220, toMm: 240, atMs: 0 });
    const second = dragCommand({ fromMm: 240, toMm: 260, atMs: 100 });
    const secondPush = pushOf([second]);

    stack.push(pushOf([first]));
    stack.push(secondPush);

    expect(stack.undoSteps()[0]?.entryIds).toHaveLength(2);
    expect(stack.drop(secondPush.entry.id)).toBe(true);

    const steps = stack.undoSteps();

    expect(steps).toHaveLength(1);
    expect(steps[0]?.entryIds).toHaveLength(1);
    expect(applyPatch(createGraph(), steps[0]?.redoPatches ?? []).byId[WALL_ID]).toEqual({
      ...wallFixture,
      thicknessMm: 240,
    });
  });

  it('removes an unfolded step whole, and refuses anything but the newest entry', () => {
    const stack = createHistoryStack();
    const first = pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })]);
    const second = pushOf([dragCommand({ fromMm: 240, toMm: 260, atMs: 1000 })]);

    stack.push(first);
    stack.push(second);

    expect(stack.drop(first.entry.id)).toBe(false);
    expect(stack.drop(second.entry.id)).toBe(true);
    expect(stack.undoSteps()).toHaveLength(1);
    expect(stack.drop(second.entry.id)).toBe(false);
  });

  it('forgets everything on clear', () => {
    const stack = createHistoryStack();

    stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })]));
    stack.undo();
    stack.clear();

    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.undoSteps()).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Labels.                                                                     */
/* -------------------------------------------------------------------------- */

describe('buildHistoryLabel', () => {
  it('names one entity by its code', () => {
    const stack = createHistoryStack();

    stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })]));

    expect(stack.undoSteps()[0]?.label).toBe(`Kéo tường ${WALL_ID}`);
  });

  it('counts several entities of one kind', () => {
    expect(buildHistoryLabel([removeFurnitureCommand()], 'dự phòng')).toBe('Xoá 3 đồ đạc');
  });

  it('keeps a folded run under the label it started with', () => {
    const stack = createHistoryStack();

    stack.push(pushOf([dragCommand({ fromMm: 220, toMm: 240, atMs: 0 })]));
    stack.push(pushOf([dragCommand({ fromMm: 240, toMm: 260, atMs: 100 })]));

    expect(stack.undoSteps()[0]?.label).toBe(`Kéo tường ${WALL_ID}`);
  });

  it('falls back to the description when the action has no name of its own', () => {
    const command = createCommand({
      type: 'wall.reticulate',
      actorId: 'user-01',
      description: 'Chia lưới tường',
      changes: [changeForUpdate('wall', wallFixture, { ...wallFixture, thicknessMm: 240 })],
      id: nextCommandId(),
      timestamp: isoAt(0),
    });

    expect(buildHistoryLabel([command], 'Chia lưới tường')).toBe('Chia lưới tường');
  });

  it('falls back for a step holding more than one command', () => {
    const commands = [
      dragCommand({ fromMm: 220, toMm: 240, atMs: 0 }),
      dragCommand({ fromMm: 220, toMm: 240, atMs: 10, wall: otherWallFixture }),
    ];

    expect(buildHistoryLabel(commands, 'Gộp 2 thay đổi')).toBe('Gộp 2 thay đổi');
  });
});

/* -------------------------------------------------------------------------- */
/* The fold itself.                                                            */
/* -------------------------------------------------------------------------- */

describe('mergeCommands', () => {
  it('keeps the first snapshot before and the last snapshot after', () => {
    const first = dragCommand({ fromMm: 220, toMm: 240, atMs: 0 });
    const second = dragCommand({ fromMm: 240, toMm: 260, atMs: 100 });
    const folded = mergeCommands(first, second);

    expect(folded.changes).toHaveLength(1);
    expect(folded.changes[0]?.before).toEqual({ ...wallFixture, thicknessMm: 220 });
    expect(folded.changes[0]?.after).toEqual({ ...wallFixture, thicknessMm: 260 });
    // The run keeps the identity it started with, and the time it last moved.
    expect(folded.id).toBe(first.id);
    expect(folded.timestamp).toBe(second.timestamp);
    expect(folded.scope).toEqual(first.scope);
  });

  it('reads an unreadable timestamp as "do not fold"', () => {
    const first = dragCommand({ fromMm: 220, toMm: 240, atMs: 0 });
    const broken = { ...dragCommand({ fromMm: 240, toMm: 260, atMs: 100 }), timestamp: 'lúc nãy' };

    expect(canMergeCommands(first, broken)).toBe(false);
  });

  it('folds a run into one command per run', () => {
    const run = [
      dragCommand({ fromMm: 220, toMm: 240, atMs: 0 }),
      dragCommand({ fromMm: 240, toMm: 260, atMs: 100 }),
      // The hand pauses here, so a second run starts.
      dragCommand({ fromMm: 260, toMm: 280, atMs: 900 }),
      dragCommand({ fromMm: 280, toMm: 300, atMs: 1000 }),
    ];

    const folded = mergeCommandRun(run);

    expect(folded).toHaveLength(2);
    expect(folded[0]?.changes[0]?.after).toEqual({ ...wallFixture, thicknessMm: 260 });
    expect(folded[1]?.changes[0]?.before).toEqual({ ...wallFixture, thicknessMm: 260 });
    expect(folded[1]?.changes[0]?.after).toEqual({ ...wallFixture, thicknessMm: 300 });
  });

  it('leaves a graph in the same place whether the run was folded or replayed', () => {
    const run = [
      dragCommand({ fromMm: 220, toMm: 240, atMs: 0 }),
      dragCommand({ fromMm: 240, toMm: 260, atMs: 100 }),
      dragCommand({ fromMm: 260, toMm: 280, atMs: 200 }),
    ];

    const replayed = run.reduce((graph, command) => applyPatch(graph, commandToPatches(command)), createGraph());
    const folded = mergeCommandRun(run).reduce(
      (graph, command) => applyPatch(graph, commandToPatches(command)),
      createGraph(),
    );

    expect(folded).toEqual(replayed);
  });
});
