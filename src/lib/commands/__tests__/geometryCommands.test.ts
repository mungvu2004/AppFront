/**
 * The two geometry commands the property inspector drags, folded and undone.
 *
 * A person changing a wall height or a furniture size does not send one edit,
 * they send one per animation frame. The thing that has to be true of
 * `wall.changeHeight` and `furniture.resize` is therefore the same thing that
 * is true of `wall.changeThickness`: a whole drag folds into **one** undo step,
 * and **one** Ctrl+Z puts back the number that was there before the hand moved.
 *
 * Nothing here is mocked. Each frame is built against the graph the previous
 * frame left behind, exactly as `dispatch` builds them, and the fold is the
 * real `mergeCommandRun`. What is asserted is the count a person would count
 * in the undo list, and the value they would read after undoing.
 */

import { describe, expect, it } from 'vitest';

import { applyPatch } from '@/domain/spatial/applyPatch';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, Level, Opening, SpatialGraph, Wall } from '@/domain/spatial/types';
import {
  createResizeFurnitureCommand,
  OPENING_COMMAND_TYPES,
  validateResizeFurniture,
} from '@/lib/commands/business/openingCommands';
import type { CommandContext, CommandResult } from '@/lib/commands/business/shared';
import {
  createChangeWallHeightCommand,
  validateChangeWallHeight,
  WALL_COMMAND_TYPES,
} from '@/lib/commands/business/wallCommands';
import { commandToPatches, invertCommand } from '@/lib/commands/invert';
import {
  canMergeCommands,
  mergeCommandRun,
  MERGE_WINDOW_MS,
} from '@/lib/commands/mergeCommands';
import type { Command } from '@/lib/commands/types';

/* -------------------------------------------------------------------------- */
/* Fixture — one wall with a window, one piece of furniture off its centre.    */
/* -------------------------------------------------------------------------- */

const LEVEL = 'L-DRAG01AAAA' as const;
const WALL = 'W-DRAG01AAAA' as const;
const WINDOW = 'D-DRAG01AAAA' as const;
const WARDROBE = 'F-DRAG01AAAA' as const;

const START_HEIGHT_MM = 3400;
const WINDOW_HEAD_MM = 2300;

const APPROVED = { confidence: 1, source: 'human', reviewed: true } as const;

const level: Level = {
  ...APPROVED,
  id: LEVEL,
  name: 'Tầng 1',
  order: 0,
  elevationMm: 0,
  heightMm: 3600,
};

const wall: Wall = {
  ...APPROVED,
  id: WALL,
  levelId: LEVEL,
  centreline: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
  thicknessMm: 220,
  heightMm: START_HEIGHT_MM,
  kind: 'loadBearing',
  openingIds: [WINDOW],
};

const window: Opening = {
  ...APPROVED,
  id: WINDOW,
  wallId: WALL,
  kind: 'window',
  offsetMm: 2000,
  widthMm: 1200,
  heightMm: 1400,
  sillHeightMm: 900,
  swing: 'sliding',
};

/**
 * A wardrobe whose centre is deliberately **not** the middle of its box.
 *
 * It is the case that tells the two anchors apart: scaling about the box's own
 * middle would move the centre, scaling about the centre leaves it alone.
 */
const wardrobe: Furniture = {
  ...APPROVED,
  id: WARDROBE,
  levelId: LEVEL,
  kind: 'wardrobe',
  centre: { x: 1200, y: 1000 },
  boundingBox: { min: { x: 1000, y: 800 }, max: { x: 2000, y: 1400 } },
  rotationDeg: 0,
};

const graphFixture: SpatialGraph = {
  building: {
    ...APPROVED,
    name: 'Nhà mẫu thao tác kéo',
    datumElevationMm: 0,
    grossFloorAreaM2: 248.6,
  },
  levels: [level],
  walls: [wall],
  openings: [window],
  furniture: [wardrobe],
  rooms: [],
  axes: [],
  dimensions: [],
  notes: [],
};

const baseGraph: NormalizedSpatial = normalizeSpatial(graphFixture);

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

/** The command, or a failure naming every reason it was refused. */
const expectCommand = (result: CommandResult): Command => {
  if (!result.ok) {
    throw new Error(`Command refused: ${result.error.reasons.join(' ')}`);
  }

  return result.data;
};

const DRAG_START = Date.parse('2026-08-14T09:15:00.000Z');

/** One frame of a drag: its own id, and its own moment in the run. */
const frameContext = (graph: NormalizedSpatial, frame: number, gapMs: number): CommandContext => ({
  graph,
  actorId: 'U-QC-01',
  id: `C-DRAG${String(frame).padStart(4, '0')}`,
  timestamp: new Date(DRAG_START + frame * gapMs).toISOString(),
});

const applyCommand = (graph: NormalizedSpatial, command: Command): NormalizedSpatial =>
  applyPatch(graph, commandToPatches(command));

/**
 * A whole drag, frame by frame, against the graph each frame leaves behind.
 *
 * Returns the commands in the order they were made and the graph they ended
 * on, so a test can compare the fold against the frame-by-frame result.
 */
const drag = (
  frames: readonly number[],
  build: (value: number, context: CommandContext) => CommandResult,
  gapMs: number,
): { readonly commands: readonly Command[]; readonly graph: NormalizedSpatial } => {
  let graph = baseGraph;
  const commands: Command[] = [];

  frames.forEach((value, index) => {
    const command = expectCommand(build(value, frameContext(graph, index, gapMs)));

    commands.push(command);
    graph = applyCommand(graph, command);
  });

  return { commands, graph };
};

/** Twelve frames of a hand pulling the top of the wall down. */
const HEIGHT_FRAMES: readonly number[] = [
  3380, 3340, 3300, 3260, 3210, 3160, 3110, 3060, 3010, 2960, 2910, 2880,
];

/** Ten frames of a hand pulling a wardrobe wider. */
const WIDTH_FRAMES: readonly number[] = [1040, 1090, 1150, 1220, 1300, 1390, 1490, 1600, 1720, 1850];

const FRAME_GAP_MS = 40;

/* -------------------------------------------------------------------------- */

describe('dragging a wall height', () => {
  it('folds a whole drag into one undo step that lands where the hand stopped', () => {
    const dragged = drag(
      HEIGHT_FRAMES,
      (heightMm, context) => createChangeWallHeightCommand({ wallId: WALL, heightMm }, context),
      FRAME_GAP_MS,
    );
    const folded = mergeCommandRun(dragged.commands);

    expect(dragged.commands).toHaveLength(HEIGHT_FRAMES.length);
    expect(folded).toHaveLength(1);
    expect(folded[0]?.type).toBe(WALL_COMMAND_TYPES.changeHeight);
    expect(applyCommand(baseGraph, folded[0] as Command).byId[WALL]).toMatchObject({
      heightMm: 2880,
    });
  });

  it('gives back the height the drag started from in one undo', () => {
    const dragged = drag(
      HEIGHT_FRAMES,
      (heightMm, context) => createChangeWallHeightCommand({ wallId: WALL, heightMm }, context),
      FRAME_GAP_MS,
    );
    const folded = mergeCommandRun(dragged.commands)[0] as Command;
    const after = applyCommand(baseGraph, folded);

    expect(applyCommand(after, invertCommand(folded)).byId[WALL]).toMatchObject({
      heightMm: START_HEIGHT_MM,
    });
  });

  it('accepts two consecutive frames as one run, and a pause as two', () => {
    const dragged = drag(
      HEIGHT_FRAMES,
      (heightMm, context) => createChangeWallHeightCommand({ wallId: WALL, heightMm }, context),
      FRAME_GAP_MS,
    );
    const [first, second] = dragged.commands;

    expect(canMergeCommands(first as Command, second as Command)).toBe(true);
    expect(mergeCommandRun(drag(
      HEIGHT_FRAMES,
      (heightMm, context) => createChangeWallHeightCommand({ wallId: WALL, heightMm }, context),
      MERGE_WINDOW_MS,
    ).commands)).toHaveLength(HEIGHT_FRAMES.length);
  });

  it('stops the drag at the window rather than cutting through its head', () => {
    const result = createChangeWallHeightCommand(
      { wallId: WALL, heightMm: WINDOW_HEAD_MM - 100 },
      frameContext(baseGraph, 0, FRAME_GAP_MS),
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.error.reasons.join(' ')).toContain('còn thiếu 100 mm');
    expect(baseGraph.byId[WALL]).toMatchObject({ heightMm: START_HEIGHT_MM });
  });
});

describe('dragging a furniture size', () => {
  it('folds a whole drag into one undo step that lands where the hand stopped', () => {
    const dragged = drag(
      WIDTH_FRAMES,
      (widthMm, context) =>
        createResizeFurnitureCommand({ furnitureId: WARDROBE, widthMm }, context),
      FRAME_GAP_MS,
    );
    const folded = mergeCommandRun(dragged.commands);

    expect(dragged.commands).toHaveLength(WIDTH_FRAMES.length);
    expect(folded).toHaveLength(1);
    expect(folded[0]?.type).toBe(OPENING_COMMAND_TYPES.resizeFurniture);
    expect(applyCommand(baseGraph, folded[0] as Command).byId[WARDROBE]).toEqual(
      dragged.graph.byId[WARDROBE],
    );
  });

  it('gives back the box the drag started from in one undo', () => {
    const dragged = drag(
      WIDTH_FRAMES,
      (widthMm, context) =>
        createResizeFurnitureCommand({ furnitureId: WARDROBE, widthMm }, context),
      FRAME_GAP_MS,
    );
    const folded = mergeCommandRun(dragged.commands)[0] as Command;
    const after = applyCommand(baseGraph, folded);

    expect(applyCommand(after, invertCommand(folded)).byId[WARDROBE]).toEqual(
      baseGraph.byId[WARDROBE],
    );
  });

  it('holds the centre still through every frame, wherever it sits in the box', () => {
    const dragged = drag(
      WIDTH_FRAMES,
      (widthMm, context) =>
        createResizeFurnitureCommand({ furnitureId: WARDROBE, widthMm }, context),
      FRAME_GAP_MS,
    );

    expect(dragged.graph.byId[WARDROBE]).toMatchObject({
      centre: { x: 1200, y: 1000 },
      // The centre sits 200 mm from the left edge of a 1.000 mm box, a fifth of
      // the way in; at 1.850 mm it is 370 mm in, the same fifth.
      boundingBox: { min: { x: 830, y: 800 }, max: { x: 2680, y: 1400 } },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Damaged drawings — what each command says instead of throwing.              */
/* -------------------------------------------------------------------------- */

/** The fixture graph with some of its entities swapped for damaged ones. */
const graphWith = (
  patch: Partial<Pick<SpatialGraph, 'levels' | 'walls' | 'openings' | 'furniture'>>,
): NormalizedSpatial => normalizeSpatial({ ...graphFixture, ...patch });

const contextOn = (graph: NormalizedSpatial): CommandContext => frameContext(graph, 0, 0);

const expectReasons = (result: CommandResult): readonly string[] => {
  if (result.ok) {
    throw new Error(`Expected a refusal, got command ${result.data.type}.`);
  }

  return result.error.reasons;
};

describe('the two geometry commands on a drawing that is damaged', () => {
  it('says which wall it could not find rather than throwing', () => {
    expect(
      validateChangeWallHeight(
        { wallId: 'W-MISSING1AA', heightMm: 2800 },
        contextOn(baseGraph),
      ).join(' '),
    ).toContain('Không tìm thấy tường W-MISSING1AA');
  });

  it('names the storey a wall points at when that storey is gone', () => {
    const orphaned = graphWith({ levels: [{ ...level, id: 'L-OTHER01AAA' }] });

    expect(
      validateChangeWallHeight({ wallId: WALL, heightMm: 2800 }, contextOn(orphaned)).join(' '),
    ).toContain(`tầng ${LEVEL} không tồn tại`);
  });

  it('refuses to judge the openings on a wall whose own measurements are unreadable', () => {
    const unreadable = graphWith({ walls: [{ ...wall, thicknessMm: Number.NaN }] });

    expect(
      validateChangeWallHeight({ wallId: WALL, heightMm: 2800 }, contextOn(unreadable)).join(' '),
    ).toContain('1 lỗ mở trên nó');
  });

  it('still lets a wall whose stored height is unreadable be given a real one', () => {
    const unreadable = graphWith({ walls: [{ ...wall, heightMm: Number.NaN }] });
    const command = expectCommand(
      createChangeWallHeightCommand({ wallId: WALL, heightMm: 2800 }, contextOn(unreadable)),
    );

    expect(applyCommand(unreadable, command).byId[WALL]).toMatchObject({ heightMm: 2800 });
  });

  it('leaves the opening count out of the sentence when the wall has none', () => {
    const bare = graphWith({ walls: [{ ...wall, openingIds: [] }], openings: [] });
    const command = expectCommand(
      createChangeWallHeightCommand({ wallId: WALL, heightMm: 2800 }, contextOn(bare)),
    );

    expect(command.description).toContain('2.800 mm');
    expect(command.description).not.toContain('lỗ mở');
  });

  it('says which piece of furniture it could not find rather than throwing', () => {
    expect(
      validateResizeFurniture(
        { furnitureId: 'F-MISSING1AA', widthMm: 900 },
        contextOn(baseGraph),
      ).join(' '),
    ).toContain('Không tìm thấy đồ đạc F-MISSING1AA');
  });

  it('refuses to scale a box that has no size to scale from', () => {
    const flattened = graphWith({
      furniture: [
        {
          ...wardrobe,
          centre: { x: 1000, y: 1000 },
          boundingBox: { min: { x: 1000, y: 800 }, max: { x: 1000, y: 1400 } },
        },
      ],
    });

    expect(
      expectReasons(
        createResizeFurnitureCommand({ furnitureId: WARDROBE, widthMm: 900 }, contextOn(flattened)),
      ).join(' '),
    ).toContain('cả hai cạnh ');
  });

  it('refuses to scale about a centre it cannot read', () => {
    const adrift = graphWith({ furniture: [{ ...wardrobe, centre: { x: Number.NaN, y: 1000 } }] });

    expect(
      validateResizeFurniture({ furnitureId: WARDROBE, widthMm: 900 }, contextOn(adrift)).join(' '),
    ).toContain('Toạ độ tâm đồ đạc không đọc được');
  });
});
