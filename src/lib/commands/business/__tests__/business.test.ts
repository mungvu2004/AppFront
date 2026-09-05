/**
 * Every business command, each run and then undone.
 *
 * One property carries the whole file: **applying a command and then applying
 * its inverse leaves the drawing exactly as it was**. It is checked for all
 * twenty-three, from the same starting graph, through the real patch pipeline —
 * `commandToPatches`, `applyPatch`, `invertCommand` — rather than through a
 * stub, so what is proved is what the store will actually do.
 *
 * Two things are compared, and the difference matters. `byId` is compared
 * deep, because that is the data: every entity has to come back byte for byte.
 * `byKind` and `byLevel` are compared as sets, because they are indexes and
 * `applyPatch` appends a re-added entity rather than putting it back at the
 * position it was deleted from. Nothing about the drawing depends on that
 * position, and demanding it would test the index rather than the undo.
 *
 * The fixture is a small floor built for this file rather than the shared
 * sample building: the sample carries openings that overrun their walls on
 * purpose, and every opening command here would be refused by its own
 * validation before it ever reached the round trip. Its headline figure —
 * 248,60 m² — is kept on the building so the standard number still travels
 * with the fixture.
 */

import { describe, expect, it } from 'vitest';

import { applyPatch } from '@/domain/spatial/applyPatch';
import { checkIntegrity } from '@/domain/spatial/integrity';
import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Dimension,
  Furniture,
  Level,
  Opening,
  Room,
  SpatialGraph,
  Wall,
} from '@/domain/spatial/types';
import { commandToPatches, invertCommand } from '@/lib/commands/invert';
import type { Command } from '@/lib/commands/types';

import {
  createAddFurnitureCommand,
  createAddOpeningCommand,
  createDeleteFurnitureCommand,
  createDeleteOpeningCommand,
  createMoveFurnitureCommand,
  createMoveOpeningCommand,
  createResizeFurnitureCommand,
  createResizeOpeningCommand,
  createRotateFurnitureCommand,
  validateAddOpening,
  validateMoveFurniture,
  validateResizeFurniture,
  validateResizeOpening,
} from '../openingCommands';
import {
  createChangeLevelElevationCommand,
  createChangeRoomUsageCommand,
  createMergeRoomsCommand,
  createRenameRoomCommand,
  createReorderLevelsCommand,
  createSplitRoomCommand,
  validateChangeLevelElevation,
  validateMergeRooms,
  validateRenameRoom,
  validateSplitRoom,
} from '../roomFloorCommands';
import type { CommandContext, CommandResult } from '../shared';
import {
  createChangeWallHeightCommand,
  createChangeWallKindCommand,
  createChangeWallThicknessCommand,
  createDeleteWallCommand,
  createDragWallEndCommand,
  createDrawWallCommand,
  createMergeWallsCommand,
  createSplitWallCommand,
  validateChangeWallHeight,
  validateChangeWallThickness,
  validateDragWallEnd,
  validateDrawWall,
  validateMergeWalls,
} from '../wallCommands';

/* -------------------------------------------------------------------------- */
/* Fixture — one floor, built to exercise every command.                       */
/* -------------------------------------------------------------------------- */

const LEVEL_ONE = 'L-LVL001AAAA' as const;
const LEVEL_TWO = 'L-LVL002AAAA' as const;
const LEVEL_THREE = 'L-LVL003AAAA' as const;

const SOUTH_WALL = 'W-SOUTH01AAA' as const;
const EAST_WALL = 'W-EAST01AAAA' as const;
const NORTH_WALL = 'W-NORTH01AAA' as const;
const WEST_WALL = 'W-WEST01AAAA' as const;
const RUN_WALL_LEFT = 'W-MERGE01AAA' as const;
const RUN_WALL_RIGHT = 'W-MERGE02AAA' as const;
const SPLIT_PIECE_ID = 'W-SPLIT01AAA' as const;
const DRAWN_WALL_ID = 'W-NEWWALLAAA' as const;

const FRONT_DOOR = 'D-DOOR01AAAA' as const;
const FRONT_WINDOW = 'D-WNDW01AAAA' as const;
const RUN_DOOR = 'D-DOOR02AAAA' as const;
const ADDED_WINDOW = 'D-NEWWNDWAAA' as const;

const LIVING_ROOM = 'R-LIVE01AAAA' as const;
const LEFT_ROOM = 'R-PARTAAAAAA' as const;
const RIGHT_ROOM = 'R-PARTBAAAAA' as const;
const SPLIT_ROOM_ID = 'R-NEWPARTAAA' as const;

const TABLE = 'F-TABL01AAAA' as const;
const CHAIR = 'F-CHAI01AAAA' as const;
const ADDED_CHAIR = 'F-NEWCHRAAAA' as const;

const SOUTH_DIMENSION = 'M-DIMN01AAAA' as const;

/** Standard sample floor area, kept on the building (invariant A14). */
const SAMPLE_TOTAL_AREA_M2 = 248.6;

const STOREY_HEIGHT_MM = 3600;
const WALL_HEIGHT_MM = 3400;
const WALL_THICKNESS_MM = 220;
const RUN_THICKNESS_MM = 200;

const APPROVED = { confidence: 1, source: 'human', reviewed: true } as const;
const DETECTED = { confidence: 0.9, source: 'ai', reviewed: false } as const;

const levels: Level[] = [
  { ...APPROVED, id: LEVEL_ONE, name: 'Tầng 1', order: 0, elevationMm: 0, heightMm: STOREY_HEIGHT_MM },
  {
    ...APPROVED,
    id: LEVEL_TWO,
    name: 'Tầng 2',
    order: 1,
    elevationMm: STOREY_HEIGHT_MM,
    heightMm: STOREY_HEIGHT_MM,
  },
  {
    ...APPROVED,
    id: LEVEL_THREE,
    name: 'Tầng 3',
    order: 2,
    elevationMm: STOREY_HEIGHT_MM * 2,
    heightMm: STOREY_HEIGHT_MM,
  },
];

const walls: Wall[] = [
  {
    ...DETECTED,
    id: SOUTH_WALL,
    levelId: LEVEL_ONE,
    centreline: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
    thicknessMm: WALL_THICKNESS_MM,
    heightMm: WALL_HEIGHT_MM,
    kind: 'loadBearing',
    openingIds: [FRONT_DOOR, FRONT_WINDOW],
  },
  {
    ...DETECTED,
    id: EAST_WALL,
    levelId: LEVEL_ONE,
    centreline: { start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 } },
    thicknessMm: WALL_THICKNESS_MM,
    heightMm: WALL_HEIGHT_MM,
    kind: 'loadBearing',
    openingIds: [],
  },
  {
    ...DETECTED,
    id: NORTH_WALL,
    levelId: LEVEL_ONE,
    centreline: { start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 } },
    thicknessMm: WALL_THICKNESS_MM,
    heightMm: WALL_HEIGHT_MM,
    kind: 'loadBearing',
    openingIds: [],
  },
  {
    ...DETECTED,
    id: WEST_WALL,
    levelId: LEVEL_ONE,
    centreline: { start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } },
    thicknessMm: WALL_THICKNESS_MM,
    heightMm: WALL_HEIGHT_MM,
    kind: 'loadBearing',
    openingIds: [],
  },
  {
    ...DETECTED,
    id: RUN_WALL_LEFT,
    levelId: LEVEL_ONE,
    centreline: { start: { x: 0, y: 8000 }, end: { x: 3000, y: 8000 } },
    thicknessMm: RUN_THICKNESS_MM,
    heightMm: WALL_HEIGHT_MM,
    kind: 'partition',
    openingIds: [RUN_DOOR],
  },
  {
    ...DETECTED,
    id: RUN_WALL_RIGHT,
    levelId: LEVEL_ONE,
    centreline: { start: { x: 3000, y: 8000 }, end: { x: 7000, y: 8000 } },
    thicknessMm: RUN_THICKNESS_MM,
    heightMm: WALL_HEIGHT_MM,
    kind: 'partition',
    openingIds: [],
  },
];

const openings: Opening[] = [
  {
    ...DETECTED,
    id: FRONT_DOOR,
    wallId: SOUTH_WALL,
    kind: 'door',
    offsetMm: 1000,
    widthMm: 900,
    heightMm: 2200,
    sillHeightMm: 0,
    swing: 'left',
  },
  {
    ...DETECTED,
    id: FRONT_WINDOW,
    wallId: SOUTH_WALL,
    kind: 'window',
    offsetMm: 3000,
    widthMm: 1200,
    heightMm: 1400,
    sillHeightMm: 900,
    swing: 'sliding',
  },
  {
    ...DETECTED,
    id: RUN_DOOR,
    wallId: RUN_WALL_LEFT,
    kind: 'door',
    offsetMm: 1000,
    widthMm: 900,
    heightMm: 2200,
    sillHeightMm: 0,
    swing: 'right',
  },
];

const rooms: Room[] = [
  {
    ...APPROVED,
    id: LIVING_ROOM,
    levelId: LEVEL_ONE,
    name: 'Phòng khách',
    usage: 'livingRoom',
    outline: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 4000 },
      { x: 0, y: 4000 },
    ],
    areaM2: 24,
    wallIds: [SOUTH_WALL, EAST_WALL, NORTH_WALL, WEST_WALL],
  },
  {
    ...APPROVED,
    id: LEFT_ROOM,
    levelId: LEVEL_ONE,
    name: 'Phòng ngủ trái',
    usage: 'bedroom',
    outline: [
      { x: 0, y: 10000 },
      { x: 4000, y: 10000 },
      { x: 4000, y: 14000 },
      { x: 0, y: 14000 },
    ],
    areaM2: 16,
    wallIds: [RUN_WALL_LEFT],
  },
  {
    ...APPROVED,
    id: RIGHT_ROOM,
    levelId: LEVEL_ONE,
    name: 'Phòng ngủ phải',
    usage: 'bedroom',
    outline: [
      { x: 4000, y: 10000 },
      { x: 8000, y: 10000 },
      { x: 8000, y: 14000 },
      { x: 4000, y: 14000 },
    ],
    areaM2: 16,
    wallIds: [RUN_WALL_RIGHT],
  },
];

const furniture: Furniture[] = [
  {
    ...DETECTED,
    id: TABLE,
    levelId: LEVEL_ONE,
    roomId: LIVING_ROOM,
    kind: 'table',
    centre: { x: 4500, y: 2000 },
    boundingBox: { min: { x: 4100, y: 1600 }, max: { x: 4900, y: 2400 } },
    rotationDeg: 0,
  },
  {
    ...DETECTED,
    id: CHAIR,
    levelId: LEVEL_ONE,
    roomId: RIGHT_ROOM,
    kind: 'chair',
    centre: { x: 5500, y: 11000 },
    boundingBox: { min: { x: 5300, y: 10800 }, max: { x: 5700, y: 11200 } },
    rotationDeg: 0,
  },
];

const dimensions: Dimension[] = [
  {
    ...DETECTED,
    id: SOUTH_DIMENSION,
    levelId: LEVEL_ONE,
    kind: 'linear',
    referenceIds: [SOUTH_WALL],
    line: { start: { x: 0, y: -800 }, end: { x: 6000, y: -800 } },
    valueMm: 6000,
  },
];

const graphFixture: SpatialGraph = {
  building: {
    ...APPROVED,
    name: 'Nhà mẫu lệnh nghiệp vụ',
    datumElevationMm: 0,
    grossFloorAreaM2: SAMPLE_TOTAL_AREA_M2,
  },
  levels,
  walls,
  openings,
  furniture,
  rooms,
  axes: [],
  dimensions,
  notes: [],
};

const baseGraph: NormalizedSpatial = normalizeSpatial(graphFixture);

const context: CommandContext = {
  graph: baseGraph,
  actorId: 'U-QC-01',
  id: 'C-TEST0001',
  timestamp: '2026-08-14T09:15:00+07:00',
};

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

/** The reasons a refused command gave; fails when it was accepted. */
const expectReasons = (result: CommandResult): readonly string[] => {
  if (result.ok) {
    throw new Error(`Expected a refusal, got command ${result.data.type}.`);
  }

  return result.error.reasons;
};

const sortedIndex = (index: Readonly<Record<string, readonly string[]>>): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(index).map(([key, ids]) => [key, [...ids].sort((first, second) => (first < second ? -1 : 1))]),
  );

/**
 * The graph with its indexes read as sets.
 *
 * `byId` stays exactly as it is, because that is the data being compared;
 * only the ordering of the two indexes is normalised away.
 */
const canonical = (graph: NormalizedSpatial): unknown => ({
  building: graph.building,
  byId: graph.byId,
  notes: graph.notes,
  byKind: sortedIndex(graph.byKind),
  byLevel: sortedIndex(graph.byLevel),
});

const applyCommand = (graph: NormalizedSpatial, command: Command): NormalizedSpatial =>
  applyPatch(graph, commandToPatches(command));

const undoCommand = (graph: NormalizedSpatial, command: Command): NormalizedSpatial =>
  applyPatch(graph, commandToPatches(invertCommand(command)));

/* -------------------------------------------------------------------------- */
/* The twenty commands.                                                        */
/* -------------------------------------------------------------------------- */

interface CommandCase {
  readonly name: string;
  readonly build: () => CommandResult;
}

const wallCases: readonly CommandCase[] = [
  {
    name: 'wall.draw',
    build: () =>
      createDrawWallCommand(
        {
          id: DRAWN_WALL_ID,
          levelId: LEVEL_ONE,
          centreline: { start: { x: 0, y: 4000 }, end: { x: 0, y: 8000 } },
          thicknessMm: 300,
          heightMm: WALL_HEIGHT_MM,
          kind: 'envelope',
        },
        context,
      ),
  },
  {
    name: 'wall.dragEnd',
    build: () =>
      createDragWallEndCommand({ wallId: SOUTH_WALL, end: 'end', to: { x: 8000, y: 0 } }, context),
  },
  {
    name: 'wall.changeThickness',
    build: () => createChangeWallThicknessCommand({ wallId: SOUTH_WALL, thicknessMm: 200 }, context),
  },
  {
    name: 'wall.changeHeight',
    build: () => createChangeWallHeightCommand({ wallId: SOUTH_WALL, heightMm: 2800 }, context),
  },
  {
    name: 'wall.changeKind',
    build: () => createChangeWallKindCommand({ wallId: SOUTH_WALL, kind: 'envelope' }, context),
  },
  {
    name: 'wall.split',
    build: () =>
      createSplitWallCommand(
        { wallId: SOUTH_WALL, at: { x: 2500, y: 0 }, secondWallId: SPLIT_PIECE_ID },
        context,
      ),
  },
  {
    name: 'wall.merge',
    build: () =>
      createMergeWallsCommand({ wallId: RUN_WALL_LEFT, otherWallId: RUN_WALL_RIGHT }, context),
  },
  {
    name: 'wall.delete',
    build: () => createDeleteWallCommand({ wallId: SOUTH_WALL }, context),
  },
];

const openingCases: readonly CommandCase[] = [
  {
    name: 'opening.add',
    build: () =>
      createAddOpeningCommand(
        {
          id: ADDED_WINDOW,
          levelId: LEVEL_ONE,
          kind: 'window',
          centre: { x: 5000, y: 0 },
          widthMm: 1000,
          heightMm: 1400,
          sillHeightMm: 900,
          swing: 'sliding',
        },
        context,
      ),
  },
  {
    name: 'opening.move',
    build: () => createMoveOpeningCommand({ openingId: FRONT_DOOR, offsetMm: 2000 }, context),
  },
  {
    name: 'opening.resize',
    build: () => createResizeOpeningCommand({ openingId: FRONT_WINDOW, widthMm: 1500 }, context),
  },
  {
    name: 'opening.delete',
    build: () => createDeleteOpeningCommand({ openingId: RUN_DOOR }, context),
  },
  {
    name: 'furniture.add',
    build: () =>
      createAddFurnitureCommand(
        {
          id: ADDED_CHAIR,
          levelId: LEVEL_ONE,
          roomId: LIVING_ROOM,
          kind: 'chair',
          centre: { x: 1000, y: 1000 },
          boundingBox: { min: { x: 800, y: 800 }, max: { x: 1200, y: 1200 } },
          rotationDeg: 0,
        },
        context,
      ),
  },
  {
    name: 'furniture.move',
    build: () => createMoveFurnitureCommand({ furnitureId: TABLE, to: { x: 2000, y: 3000 } }, context),
  },
  {
    name: 'furniture.rotate',
    build: () => createRotateFurnitureCommand({ furnitureId: TABLE, rotationDeg: 90 }, context),
  },
  {
    name: 'furniture.delete',
    build: () => createDeleteFurnitureCommand({ furnitureId: CHAIR }, context),
  },
  {
    name: 'furniture.resize',
    build: () =>
      createResizeFurnitureCommand(
        { furnitureId: TABLE, widthMm: RESIZED_TABLE_WIDTH_MM },
        context,
      ),
  },
];

const mergedRoomOutline = [
  { x: 0, y: 10000 },
  { x: 8000, y: 10000 },
  { x: 8000, y: 14000 },
  { x: 0, y: 14000 },
];

const RESIZED_TABLE_WIDTH_MM = 1200;

const roomFloorCases: readonly CommandCase[] = [
  {
    name: 'room.rename',
    build: () => createRenameRoomCommand({ roomId: LIVING_ROOM, name: 'Phòng khách lớn' }, context),
  },
  {
    name: 'room.changeUsage',
    build: () => createChangeRoomUsageCommand({ roomId: LIVING_ROOM, usage: 'kitchen' }, context),
  },
  {
    name: 'room.merge',
    build: () =>
      createMergeRoomsCommand(
        { targetRoomId: LEFT_ROOM, absorbedRoomId: RIGHT_ROOM, outline: mergedRoomOutline },
        context,
      ),
  },
  {
    name: 'room.split',
    build: () =>
      createSplitRoomCommand(
        {
          roomId: LIVING_ROOM,
          newRoomId: SPLIT_ROOM_ID,
          firstOutline: [
            { x: 0, y: 0 },
            { x: 3000, y: 0 },
            { x: 3000, y: 4000 },
            { x: 0, y: 4000 },
          ],
          secondOutline: [
            { x: 3000, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 3000, y: 4000 },
          ],
        },
        context,
      ),
  },
  {
    name: 'level.changeElevation',
    build: () =>
      createChangeLevelElevationCommand({ levelId: LEVEL_THREE, elevationMm: 7400 }, context),
  },
  {
    name: 'level.reorder',
    build: () =>
      createReorderLevelsCommand({ levelIds: [LEVEL_TWO, LEVEL_ONE, LEVEL_THREE] }, context),
  },
];

const allCases: readonly CommandCase[] = [...wallCases, ...openingCases, ...roomFloorCases];

/**
 * How many business commands there are: 8 wall + 9 opening and furniture +
 * 6 room and level. The brief's summary line says twenty and the three lists
 * it enumerates name twenty-one; the two geometry commands the property
 * inspector needs — `wall.changeHeight` and `furniture.resize` — were missing
 * from both, and the lists are what is implemented.
 */
const BUSINESS_COMMAND_COUNT = 23;

/* -------------------------------------------------------------------------- */
/* The round trip.                                                             */
/* -------------------------------------------------------------------------- */

describe('business commands', () => {
  it('starts from a drawing with no integrity issue', () => {
    expect(checkIntegrity(baseGraph)).toEqual([]);
  });

  it('covers every business command exactly once', () => {
    expect(wallCases).toHaveLength(8);
    expect(openingCases).toHaveLength(9);
    expect(roomFloorCases).toHaveLength(6);
    expect(allCases).toHaveLength(BUSINESS_COMMAND_COUNT);
    expect(new Set(allCases.map((entry) => entry.name)).size).toBe(BUSINESS_COMMAND_COUNT);
  });

  it.each(allCases.map((entry) => [entry.name, entry] as const))(
    '%s changes the drawing and undoes back to exactly what was there',
    (_name, entry) => {
      const command = expectCommand(entry.build());
      const applied = applyCommand(baseGraph, command);

      expect(canonical(applied)).not.toEqual(canonical(baseGraph));
      expect(canonical(undoCommand(applied, command))).toEqual(canonical(baseGraph));
    },
  );

  it.each(allCases.map((entry) => [entry.name, entry] as const))(
    '%s names itself in Vietnamese with the figures behind it',
    (name, entry) => {
      const command = expectCommand(entry.build());

      expect(command.type).toBe(name);
      expect(command.description.trim()).not.toBe('');
      expect(command.description).toMatch(/\d/u);
      expect(command.actorId).toBe(context.actorId);
      expect(command.changes.length).toBeGreaterThan(0);
    },
  );

  it.each(allCases.map((entry) => [entry.name, entry] as const))(
    '%s carries a scope covering every entity it touches',
    (_name, entry) => {
      const command = expectCommand(entry.build());
      const scoped = new Set<string>(command.scope.entityIds);

      for (const change of command.changes) {
        expect(scoped.has(change.id)).toBe(true);
        expect(command.scope.kinds).toContain(change.kind);
        expect(change.before === null && change.after === null).toBe(false);
      }
    },
  );
});

/* -------------------------------------------------------------------------- */
/* Wall commands, in detail.                                                   */
/* -------------------------------------------------------------------------- */

describe('wall commands', () => {
  it('records the length, the thickness and the level when a wall is drawn', () => {
    const command = expectCommand(
      createDrawWallCommand(
        {
          id: DRAWN_WALL_ID,
          levelId: LEVEL_ONE,
          centreline: { start: { x: 0, y: 4000 }, end: { x: 0, y: 8000 } },
          thicknessMm: 300,
          heightMm: WALL_HEIGHT_MM,
          kind: 'envelope',
        },
        context,
      ),
    );

    expect(command.description).toContain('tường bao');
    expect(command.description).toContain('4.000 mm');
    expect(command.description).toContain('300 mm');
    expect(command.description).toContain('Tầng 1');
  });

  it('refuses a wall shorter than the minimum run', () => {
    const reasons = expectReasons(
      createDrawWallCommand(
        {
          id: DRAWN_WALL_ID,
          levelId: LEVEL_ONE,
          centreline: { start: { x: 0, y: 0 }, end: { x: 12, y: 0 } },
          thicknessMm: 200,
          heightMm: WALL_HEIGHT_MM,
          kind: 'partition',
        },
        context,
      ),
    );

    expect(reasons.join(' ')).toContain('12 mm');
    expect(reasons.join(' ')).toContain('30 mm');
  });

  it('refuses a thickness outside the buildable range', () => {
    expect(validateDrawWall(
      {
        id: DRAWN_WALL_ID,
        levelId: LEVEL_ONE,
        centreline: { start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } },
        thicknessMm: 40,
        heightMm: WALL_HEIGHT_MM,
        kind: 'partition',
      },
      context,
    ).join(' ')).toContain('60–600 mm');

    expect(validateChangeWallThickness({ wallId: SOUTH_WALL, thicknessMm: 900 }, context).join(' ')).toContain(
      '60–600 mm',
    );
  });

  it('drags the openings along with the end that moved', () => {
    const command = expectCommand(
      createDragWallEndCommand({ wallId: SOUTH_WALL, end: 'end', to: { x: 8000, y: 0 } }, context),
    );
    const movedOpenings = command.changes.filter((change) => change.kind === 'opening');

    expect(movedOpenings).toHaveLength(2);
    expect(command.description).toContain('6.000 mm');
    expect(command.description).toContain('8.000 mm');
    expect(command.description).toContain('2 lỗ mở dịch theo');
  });

  it('refuses a drag that would leave no wall behind', () => {
    expect(
      validateDragWallEnd({ wallId: SOUTH_WALL, end: 'end', to: { x: 10, y: 0 } }, context).join(' '),
    ).toContain('ngắn hơn mức tối thiểu');
  });

  it('sends each opening to the piece of wall holding it, without moving it', () => {
    const command = expectCommand(
      createSplitWallCommand(
        { wallId: SOUTH_WALL, at: { x: 2500, y: 0 }, secondWallId: SPLIT_PIECE_ID },
        context,
      ),
    );
    const applied = applyCommand(baseGraph, command);
    const door = applied.byId[FRONT_DOOR];
    const window = applied.byId[FRONT_WINDOW];

    expect(door).toMatchObject({ wallId: SOUTH_WALL, offsetMm: 1000 });
    expect(window).toMatchObject({ wallId: SPLIT_PIECE_ID, offsetMm: 500 });
    expect(applied.byId[SOUTH_WALL]).toMatchObject({ openingIds: [FRONT_DOOR] });
    expect(applied.byId[SPLIT_PIECE_ID]).toMatchObject({ openingIds: [FRONT_WINDOW] });
    expect(command.description).toContain('2.500 mm');
    expect(command.description).toContain('3.500 mm');
  });

  it('re-attaches every opening of both walls when two runs are welded', () => {
    const command = expectCommand(
      createMergeWallsCommand({ wallId: RUN_WALL_LEFT, otherWallId: RUN_WALL_RIGHT }, context),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[RUN_WALL_LEFT]).toBeUndefined();
    expect(applied.byId[RUN_DOOR]).toMatchObject({ wallId: RUN_WALL_RIGHT, offsetMm: 1000 });
    expect(applied.byId[RUN_WALL_RIGHT]).toMatchObject({ openingIds: [RUN_DOOR] });
    expect(command.description).toContain('7.000 mm');
  });

  it('refuses to weld two walls of different kinds', () => {
    expect(
      validateMergeWalls({ wallId: SOUTH_WALL, otherWallId: RUN_WALL_LEFT }, context).join(' '),
    ).toContain('khác loại');
  });

  it('takes the openings and clears every reference when a wall is deleted', () => {
    const command = expectCommand(createDeleteWallCommand({ wallId: SOUTH_WALL }, context));
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[SOUTH_WALL]).toBeUndefined();
    expect(applied.byId[FRONT_DOOR]).toBeUndefined();
    expect(applied.byId[FRONT_WINDOW]).toBeUndefined();
    expect(applied.byId[LIVING_ROOM]).toMatchObject({
      wallIds: [EAST_WALL, NORTH_WALL, WEST_WALL],
    });
    expect(applied.byId[SOUTH_DIMENSION]).toMatchObject({ referenceIds: [] });
    expect(checkIntegrity(applied)).toEqual([]);
    expect(command.description).toContain('2 lỗ mở');
  });

  it('records both heights and how many openings rode through the change', () => {
    const command = expectCommand(
      createChangeWallHeightCommand({ wallId: SOUTH_WALL, heightMm: 2800 }, context),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[SOUTH_WALL]).toMatchObject({ heightMm: 2800 });
    expect(command.description).toContain('3.400 mm');
    expect(command.description).toContain('2.800 mm');
    expect(command.description).toContain('2 lỗ mở vẫn nằm trọn trong tường');
  });

  it('undoes a height change back to the height that was there', () => {
    const command = expectCommand(
      createChangeWallHeightCommand({ wallId: SOUTH_WALL, heightMm: 2800 }, context),
    );

    expect(undoCommand(applyCommand(baseGraph, command), command).byId[SOUTH_WALL]).toMatchObject({
      heightMm: WALL_HEIGHT_MM,
    });
  });

  it('refuses to lower a wall through the head of an opening, and says by how much', () => {
    // The door's head is at 2.200 mm and the window's at 900 + 1.400 = 2.300 mm.
    const reasons = validateChangeWallHeight({ wallId: SOUTH_WALL, heightMm: 2000 }, context);

    expect(reasons).toHaveLength(2);
    expect(reasons.join(' ')).toContain(FRONT_DOOR);
    expect(reasons.join(' ')).toContain(FRONT_WINDOW);
    expect(reasons.join(' ')).toContain('còn thiếu 200 mm');
    expect(reasons.join(' ')).toContain('còn thiếu 300 mm');
  });

  it('names only the opening that no longer fits, and leaves the drawing alone', () => {
    // 2.250 mm clears the door at 2.200 mm and cuts the window at 2.300 mm.
    const reasons = expectReasons(
      createChangeWallHeightCommand({ wallId: SOUTH_WALL, heightMm: 2250 }, context),
    );

    expect(reasons).toHaveLength(1);
    expect(reasons.join(' ')).toContain(FRONT_WINDOW);
    expect(reasons.join(' ')).not.toContain(FRONT_DOOR);
    expect(reasons.join(' ')).toContain('còn thiếu 50 mm');
    expect(baseGraph.byId[FRONT_WINDOW]).toMatchObject({ heightMm: 1400, sillHeightMm: 900 });
  });

  it('lowers a wall with nothing cut into it as far as it is asked to', () => {
    expect(validateChangeWallHeight({ wallId: EAST_WALL, heightMm: 500 }, context)).toEqual([]);
  });

  it('refuses a height that is not a positive length, and one that changes nothing', () => {
    expect(
      validateChangeWallHeight({ wallId: SOUTH_WALL, heightMm: 0 }, context).join(' '),
    ).toContain('phải lớn hơn 0 mm');
    expect(
      validateChangeWallHeight({ wallId: SOUTH_WALL, heightMm: Number.NaN }, context).join(' '),
    ).toContain('phải lớn hơn 0 mm');
    expect(
      validateChangeWallHeight({ wallId: SOUTH_WALL, heightMm: WALL_HEIGHT_MM }, context).join(' '),
    ).toContain('không có gì thay đổi');
  });

  it('puts no ceiling on a wall height, because drawing one puts none either', () => {
    expect(validateChangeWallHeight({ wallId: SOUTH_WALL, heightMm: 12000 }, context)).toEqual([]);
    expect(
      validateDrawWall(
        {
          id: DRAWN_WALL_ID,
          levelId: LEVEL_ONE,
          centreline: { start: { x: 0, y: 4000 }, end: { x: 0, y: 8000 } },
          thicknessMm: 200,
          heightMm: 12000,
          kind: 'partition',
        },
        context,
      ),
    ).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Opening and furniture commands, in detail.                                  */
/* -------------------------------------------------------------------------- */

describe('opening and furniture commands', () => {
  it('finds the host wall for a new opening from where it was drawn', () => {
    const command = expectCommand(
      createAddOpeningCommand(
        {
          id: ADDED_WINDOW,
          levelId: LEVEL_ONE,
          kind: 'window',
          centre: { x: 5000, y: 0 },
          widthMm: 1000,
          heightMm: 1400,
          sillHeightMm: 900,
          swing: 'sliding',
        },
        context,
      ),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[ADDED_WINDOW]).toMatchObject({ wallId: SOUTH_WALL, offsetMm: 4500 });
    expect(applied.byId[SOUTH_WALL]).toMatchObject({
      openingIds: [FRONT_DOOR, FRONT_WINDOW, ADDED_WINDOW],
    });
    expect(command.description).toContain('4.500 mm');
  });

  it('refuses a new opening that no wall on the level will take', () => {
    const reasons = validateAddOpening(
      {
        id: ADDED_WINDOW,
        levelId: LEVEL_ONE,
        kind: 'window',
        centre: { x: 50000, y: 50000 },
        widthMm: 1000,
        heightMm: 1400,
        sillHeightMm: 900,
        swing: 'sliding',
      },
      context,
    );

    expect(reasons.join(' ')).toContain('mồ côi');
  });

  it('refuses an opening that would overlap the one already on the wall', () => {
    expect(validateResizeOpening({ openingId: FRONT_DOOR, widthMm: 4000 }, context).join(' ')).toContain(
      'chồng lên',
    );
  });

  it('keeps the centre of an opening where it was when it is made wider', () => {
    const command = expectCommand(
      createResizeOpeningCommand({ openingId: FRONT_WINDOW, widthMm: 1500 }, context),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[FRONT_WINDOW]).toMatchObject({ widthMm: 1500, offsetMm: 2850 });
    expect(command.description).toContain('1.200 mm');
    expect(command.description).toContain('1.500 mm');
  });

  it('takes an opening off its wall list when it is deleted', () => {
    const command = expectCommand(createDeleteOpeningCommand({ openingId: RUN_DOOR }, context));
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[RUN_WALL_LEFT]).toMatchObject({ openingIds: [] });
    expect(checkIntegrity(applied)).toEqual([]);
  });

  it('carries the bounding box along when furniture moves', () => {
    const command = expectCommand(
      createMoveFurnitureCommand({ furnitureId: TABLE, to: { x: 2000, y: 3000 } }, context),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[TABLE]).toMatchObject({
      centre: { x: 2000, y: 3000 },
      boundingBox: { min: { x: 1600, y: 2600 }, max: { x: 2400, y: 3400 } },
    });
  });

  it('refuses to move furniture outside the room it belongs to', () => {
    expect(
      validateMoveFurniture({ furnitureId: TABLE, to: { x: 20000, y: 20000 } }, context).join(' '),
    ).toContain('nằm ngoài ranh phòng');
  });

  it('folds a rotation into a single turn', () => {
    const command = expectCommand(
      createRotateFurnitureCommand({ furnitureId: TABLE, rotationDeg: 450 }, context),
    );

    expect(applyCommand(baseGraph, command).byId[TABLE]).toMatchObject({ rotationDeg: 90 });
    expect(command.description).toContain('90°');
  });

  it('stretches the bounding box about the centre, which does not move', () => {
    const command = expectCommand(
      createResizeFurnitureCommand({ furnitureId: TABLE, widthMm: RESIZED_TABLE_WIDTH_MM }, context),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[TABLE]).toMatchObject({
      centre: { x: 4500, y: 2000 },
      boundingBox: { min: { x: 3900, y: 1600 }, max: { x: 5100, y: 2400 } },
    });
    expect(command.description).toContain('800 mm');
    expect(command.description).toContain('1.200 mm');
    expect(command.description).toContain('giữ nguyên tâm');
  });

  it('undoes a resize back to the box that was there', () => {
    const command = expectCommand(
      createResizeFurnitureCommand({ furnitureId: TABLE, depthMm: 300 }, context),
    );

    expect(undoCommand(applyCommand(baseGraph, command), command).byId[TABLE]).toMatchObject({
      boundingBox: { min: { x: 4100, y: 1600 }, max: { x: 4900, y: 2400 } },
    });
  });

  it('changes only the side it was given', () => {
    const applied = applyCommand(
      baseGraph,
      expectCommand(createResizeFurnitureCommand({ furnitureId: TABLE, depthMm: 400 }, context)),
    );

    expect(applied.byId[TABLE]).toMatchObject({
      boundingBox: { min: { x: 4100, y: 1800 }, max: { x: 4900, y: 2200 } },
    });
  });

  it('refuses a side that is not a positive length, and a resize that names nothing', () => {
    expect(
      validateResizeFurniture({ furnitureId: TABLE, widthMm: 0 }, context).join(' '),
    ).toContain('Chiều rộng đồ đạc phải lớn hơn 0 mm');
    expect(
      validateResizeFurniture({ furnitureId: TABLE, depthMm: Number.NaN }, context).join(' '),
    ).toContain('Chiều sâu đồ đạc phải lớn hơn 0 mm');
    expect(validateResizeFurniture({ furnitureId: TABLE }, context).join(' ')).toContain(
      'không nêu số đo nào cần đổi',
    );
    expect(
      validateResizeFurniture({ furnitureId: TABLE, widthMm: 800, depthMm: 800 }, context).join(' '),
    ).toContain('không có gì thay đổi');
  });

  it('leaves the clash with a wall or another piece to the rule that owns it', () => {
    // A table blown up to five metres runs straight through the living room's
    // walls; FURNITURE-CLASH warns about that afterwards, the command does not.
    const command = expectCommand(
      createResizeFurnitureCommand({ furnitureId: TABLE, widthMm: 5000, depthMm: 5000 }, context),
    );

    expect(applyCommand(baseGraph, command).byId[TABLE]).toMatchObject({
      centre: { x: 4500, y: 2000 },
      boundingBox: { min: { x: 2000, y: -500 }, max: { x: 7000, y: 4500 } },
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Room and level commands, in detail.                                         */
/* -------------------------------------------------------------------------- */

describe('room and level commands', () => {
  it('refuses a name another room on the same level already carries', () => {
    expect(
      validateRenameRoom({ roomId: LEFT_ROOM, name: 'Phòng ngủ phải' }, context).join(' '),
    ).toContain(RIGHT_ROOM);
  });

  it('measures the merged room from the outline it was given', () => {
    const command = expectCommand(
      createMergeRoomsCommand(
        { targetRoomId: LEFT_ROOM, absorbedRoomId: RIGHT_ROOM, outline: mergedRoomOutline },
        context,
      ),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[RIGHT_ROOM]).toBeUndefined();
    expect(applied.byId[LEFT_ROOM]).toMatchObject({ areaM2: 32 });
    expect(applied.byId[CHAIR]).toMatchObject({ roomId: LEFT_ROOM });
    expect(command.description).toContain('32,00 m²');
    expect(checkIntegrity(applied)).toEqual([]);
  });

  it('refuses a merged outline smaller than the rooms it swallows', () => {
    expect(
      validateMergeRooms(
        {
          targetRoomId: LEFT_ROOM,
          absorbedRoomId: RIGHT_ROOM,
          outline: [
            { x: 0, y: 10000 },
            { x: 4000, y: 10000 },
            { x: 4000, y: 14000 },
            { x: 0, y: 14000 },
          ],
        },
        context,
      ).join(' '),
    ).toContain('nhỏ hơn tổng');
  });

  it('splits a room into two pieces that add back up to it', () => {
    const command = expectCommand(
      createSplitRoomCommand(
        {
          roomId: LIVING_ROOM,
          newRoomId: SPLIT_ROOM_ID,
          firstOutline: [
            { x: 0, y: 0 },
            { x: 3000, y: 0 },
            { x: 3000, y: 4000 },
            { x: 0, y: 4000 },
          ],
          secondOutline: [
            { x: 3000, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 3000, y: 4000 },
          ],
        },
        context,
      ),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[LIVING_ROOM]).toMatchObject({ areaM2: 12 });
    expect(applied.byId[SPLIT_ROOM_ID]).toMatchObject({ areaM2: 12, usage: 'livingRoom' });
    // The table sits at x = 4500, which is in the second piece.
    expect(applied.byId[TABLE]).toMatchObject({ roomId: SPLIT_ROOM_ID });
    expect(command.description).toContain('12,00 m²');
    expect(checkIntegrity(applied)).toEqual([]);
  });

  it('refuses a split that makes floor area out of nothing', () => {
    expect(
      validateSplitRoom(
        {
          roomId: LIVING_ROOM,
          newRoomId: SPLIT_ROOM_ID,
          firstOutline: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
          ],
          secondOutline: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
            { x: 0, y: 4000 },
          ],
        },
        context,
      ).join(' '),
    ).toContain('không tạo thêm được mét vuông nào');
  });

  it('refuses an elevation that pushes a storey into the one below', () => {
    expect(
      validateChangeLevelElevation({ levelId: LEVEL_THREE, elevationMm: 5000 }, context).join(' '),
    ).toContain('nằm thấp hơn');
  });

  it('re-stacks the building when the storeys are reordered', () => {
    const command = expectCommand(
      createReorderLevelsCommand({ levelIds: [LEVEL_TWO, LEVEL_ONE, LEVEL_THREE] }, context),
    );
    const applied = applyCommand(baseGraph, command);

    expect(applied.byId[LEVEL_TWO]).toMatchObject({ order: 0, elevationMm: 0 });
    expect(applied.byId[LEVEL_ONE]).toMatchObject({ order: 1, elevationMm: 3600 });
    expect(applied.byId[LEVEL_THREE]).toMatchObject({ order: 2, elevationMm: 7200 });
    expect(command.description).toContain('2 tầng đổi vị trí');
  });

  it('refuses an ordering that leaves a storey out', () => {
    expect(
      expectReasons(createReorderLevelsCommand({ levelIds: [LEVEL_TWO, LEVEL_ONE] }, context)).join(' '),
    ).toContain('bỏ sót');
  });
});
