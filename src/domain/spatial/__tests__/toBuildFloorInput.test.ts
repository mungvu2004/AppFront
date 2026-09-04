import { describe, expect, it } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_DOOR_COUNT,
  sampleLevelId,
} from '../__fixtures__/sampleBuilding';
import {
  isAttached,
  type AttachedOpening,
  type Opening as DomainOpening,
} from '../../openings/types';
import { normalizeSpatial, type NormalizedSpatial } from '../normalize';
import { toBuildFloorInput } from '../toBuildFloorInput';
import type {
  EntityId,
  LevelId,
  Opening,
  OpeningId,
  Room,
  RoomId,
  SpatialGraph,
  Wall,
  WallId,
} from '../types';

/* -------------------------------------------------------------------------- */
/* A two-storey building small enough to assert every number of.               */
/* -------------------------------------------------------------------------- */

const GROUND: LevelId = 'L-GROUND0001';
const FIRST: LevelId = 'L-FIRST00001';
const MISSING_LEVEL: LevelId = 'L-NOSUCH0001';

const LOAD_WALL: WallId = 'W-LOADBEAR01';
const PARTITION_WALL: WallId = 'W-PARTITION1';
const ENVELOPE_WALL: WallId = 'W-ENVELOPE01';
const UPPER_WALL: WallId = 'W-UPPERONE01';

const MAIN_ROOM: RoomId = 'R-MAINROOM01';
const DOOR: OpeningId = 'D-DOORLEAF01';
const WINDOW: OpeningId = 'D-WINDOWPN01';

const GROUND_ELEVATION_MM = 0;
const FIRST_ELEVATION_MM = 3_300;
const LEVEL_HEIGHT_MM = 3_000;

/** Every wall runs along y = 0 and is exactly this long, so a fraction is easy to read. */
const WALL_LENGTH_MM = 4_000;
const WALL_THICKNESS_MM = 220;
const WALL_HEIGHT_MM = 2_700;

const DOOR_OFFSET_MM = 300;
const DOOR_WIDTH_MM = 900;
const DOOR_HEIGHT_MM = 2_200;
const WINDOW_OFFSET_MM = 1_000;
const WINDOW_WIDTH_MM = 1_200;
const WINDOW_HEIGHT_MM = 1_400;
const WINDOW_SILL_MM = 900;

const ROOM_WIDTH_MM = 4_000;
const ROOM_DEPTH_MM = 3_500;

const DETECTED = { confidence: 0.82, reviewed: false, source: 'ai' } as const;
const APPROVED = { confidence: 1, reviewed: true, source: 'human' } as const;

const wallAlongX = (
  id: WallId,
  levelId: LevelId,
  kind: Wall['kind'],
  startXMm: number,
): Wall => ({
  ...DETECTED,
  id,
  levelId,
  centreline: {
    start: { x: startXMm, y: 0 },
    end: { x: startXMm + WALL_LENGTH_MM, y: 0 },
  },
  thicknessMm: WALL_THICKNESS_MM,
  heightMm: WALL_HEIGHT_MM,
  kind,
  openingIds: [],
});

/**
 * A fresh graph every call, so a test may rebuild a broken variant of it without
 * touching the one the next test reads.
 */
function createGraph(): SpatialGraph {
  return {
    building: {
      ...APPROVED,
      name: 'Nhà mẫu hai tầng',
      datumElevationMm: 0,
    },
    levels: [
      {
        ...APPROVED,
        id: GROUND,
        name: 'Tầng trệt',
        order: 0,
        elevationMm: GROUND_ELEVATION_MM,
        heightMm: LEVEL_HEIGHT_MM,
      },
      {
        ...APPROVED,
        id: FIRST,
        name: 'Tầng một',
        order: 1,
        elevationMm: FIRST_ELEVATION_MM,
        heightMm: LEVEL_HEIGHT_MM,
      },
    ],
    walls: [
      wallAlongX(LOAD_WALL, GROUND, 'loadBearing', 0),
      wallAlongX(PARTITION_WALL, GROUND, 'partition', WALL_LENGTH_MM),
      wallAlongX(ENVELOPE_WALL, GROUND, 'envelope', 2 * WALL_LENGTH_MM),
      wallAlongX(UPPER_WALL, FIRST, 'loadBearing', 0),
    ],
    openings: [
      {
        ...DETECTED,
        id: DOOR,
        wallId: LOAD_WALL,
        kind: 'door',
        offsetMm: DOOR_OFFSET_MM,
        widthMm: DOOR_WIDTH_MM,
        heightMm: DOOR_HEIGHT_MM,
        sillHeightMm: 0,
        swing: 'left',
      },
      {
        ...DETECTED,
        id: WINDOW,
        wallId: PARTITION_WALL,
        kind: 'window',
        offsetMm: WINDOW_OFFSET_MM,
        widthMm: WINDOW_WIDTH_MM,
        heightMm: WINDOW_HEIGHT_MM,
        sillHeightMm: WINDOW_SILL_MM,
        swing: 'sliding',
      },
    ],
    furniture: [
      {
        ...DETECTED,
        id: 'F-CHAIR00001',
        levelId: GROUND,
        kind: 'chair',
        centre: { x: 1_000, y: 1_000 },
        boundingBox: { min: { x: 800, y: 800 }, max: { x: 1_200, y: 1_200 } },
        rotationDeg: 0,
      },
    ],
    rooms: [
      {
        ...APPROVED,
        id: MAIN_ROOM,
        levelId: GROUND,
        name: 'Phòng khách',
        usage: 'livingRoom',
        outline: [
          { x: 0, y: 0 },
          { x: ROOM_WIDTH_MM, y: 0 },
          { x: ROOM_WIDTH_MM, y: ROOM_DEPTH_MM },
          { x: 0, y: ROOM_DEPTH_MM },
        ],
        areaM2: 14,
        wallIds: [LOAD_WALL],
      },
    ],
    axes: [
      {
        ...APPROVED,
        id: 'A-AXISONE001',
        levelId: GROUND,
        label: 'A',
        direction: 'horizontal',
        line: { start: { x: 0, y: 0 }, end: { x: 3 * WALL_LENGTH_MM, y: 0 } },
      },
    ],
    dimensions: [],
    notes: [],
  };
}

const normalizedGraph = (graph: SpatialGraph = createGraph()): NormalizedSpatial =>
  normalizeSpatial(graph);

/** The storey, or a failure naming the level rather than an unhelpful `null`. */
function groundStorey(spatial: NormalizedSpatial = normalizedGraph()): NonNullable<
  ReturnType<typeof toBuildFloorInput>
> {
  const input = toBuildFloorInput(spatial, GROUND);

  if (input === null) {
    throw new Error(`fixture: level ${GROUND} is missing from the graph`);
  }

  return input;
}

/**
 * The openings the converter made, every one of them attached.
 *
 * A graph opening always names its wall, so an `OrphanOpening` is a shape this
 * converter cannot produce — asserting that here is what keeps the claim honest
 * rather than merely written in the header.
 */
function attachedOnly(openings: readonly DomainOpening[] = []): AttachedOpening[] {
  return openings.map((opening) => {
    if (!isAttached(opening)) {
      throw new Error(`opening ${opening.id} came back without a wall`);
    }

    return opening;
  });
}

/** The same graph with one wall replaced. */
const withWall = (graph: SpatialGraph, id: WallId, patch: Partial<Wall>): SpatialGraph => ({
  ...graph,
  walls: graph.walls.map((wall) => (wall.id === id ? { ...wall, ...patch } : wall)),
});

/** The same graph with one opening replaced. */
const withOpening = (
  graph: SpatialGraph,
  id: OpeningId,
  patch: Partial<Opening>,
): SpatialGraph => ({
  ...graph,
  openings: graph.openings.map((opening) =>
    opening.id === id ? { ...opening, ...patch } : opening,
  ),
});

/** The same graph with its only room replaced. */
const withRoom = (graph: SpatialGraph, patch: Partial<Room>): SpatialGraph => ({
  ...graph,
  rooms: graph.rooms.map((room) => ({ ...room, ...patch })),
});

/* -------------------------------------------------------------------------- */
/* What the builder gets.                                                      */
/* -------------------------------------------------------------------------- */

describe('toBuildFloorInput', () => {
  it('gathers the walls, rooms and openings placed on one storey', () => {
    const input = groundStorey();

    expect(input.level).toEqual({
      id: GROUND,
      elevationMm: GROUND_ELEVATION_MM,
      heightMm: LEVEL_HEIGHT_MM,
    });
    expect(input.walls.map((wall) => wall.id)).toEqual([
      LOAD_WALL,
      PARTITION_WALL,
      ENVELOPE_WALL,
    ]);
    expect(input.rooms.map((room) => room.id)).toEqual([MAIN_ROOM]);
    expect(input.openings?.map((opening) => opening.id)).toEqual([DOOR, WINDOW]);
  });

  it('leaves the slab thickness to the builder', () => {
    expect(groundStorey().slabThicknessMm).toBeUndefined();
  });

  it('reads a second storey without carrying the first one into it', () => {
    const input = toBuildFloorInput(normalizedGraph(), FIRST);

    expect(input?.level.elevationMm).toBe(FIRST_ELEVATION_MM);
    expect(input?.walls.map((wall) => wall.id)).toEqual([UPPER_WALL]);
    expect(input?.rooms).toEqual([]);
    expect(input?.openings).toEqual([]);
  });

  it('ignores the furniture, axes and dimensions on the storey', () => {
    const input = groundStorey();

    expect(Object.keys(input).sort()).toEqual(['level', 'openings', 'rooms', 'walls']);
  });
});

/* -------------------------------------------------------------------------- */
/* Crossing 1: a height above the floor becomes two elevations.                */
/* -------------------------------------------------------------------------- */

describe('wall elevations', () => {
  it('starts a wall at the finished floor of its own level', () => {
    const wall = groundStorey().walls[0];

    expect(wall?.baseElevationMm).toBe(GROUND_ELEVATION_MM);
    expect(wall?.topElevationMm).toBe(GROUND_ELEVATION_MM + WALL_HEIGHT_MM);
  });

  it('lifts an upper storey by its own elevation, not by the storey below', () => {
    const wall = toBuildFloorInput(normalizedGraph(), FIRST)?.walls[0];

    expect(wall?.baseElevationMm).toBe(FIRST_ELEVATION_MM);
    expect(wall?.topElevationMm).toBe(FIRST_ELEVATION_MM + WALL_HEIGHT_MM);
  });

  it('carries the centreline and the thickness across unchanged', () => {
    const wall = groundStorey().walls[0];

    expect(wall?.centreline).toEqual({
      start: { x: 0, y: 0 },
      end: { x: WALL_LENGTH_MM, y: 0 },
    });
    expect(wall?.thicknessMm).toBe(WALL_THICKNESS_MM);
  });
});

/* -------------------------------------------------------------------------- */
/* Crossing 2: the two wall vocabularies.                                      */
/* -------------------------------------------------------------------------- */

describe('wall kinds', () => {
  it('maps every graph kind one to one, envelope included', () => {
    const kinds = groundStorey().walls.map((wall) => wall.kind);

    expect(kinds).toEqual(['loadBearing', 'partition', 'glazed']);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('never invents a railing, which no graph kind maps onto', () => {
    const kinds = groundStorey().walls.map((wall) => wall.kind);

    expect(kinds).not.toContain('railing');
  });
});

/* -------------------------------------------------------------------------- */
/* Crossing 3: openings leave the wall.                                        */
/* -------------------------------------------------------------------------- */

describe('openings', () => {
  it('turns an offset to the left edge into a fraction of the way to the centre', () => {
    const door = attachedOnly(groundStorey().openings)[0];

    expect(door?.wallId).toBe(LOAD_WALL);
    expect(door?.relativePosition).toBeCloseTo(
      (DOOR_OFFSET_MM + DOOR_WIDTH_MM / 2) / WALL_LENGTH_MM,
      10,
    );
  });

  it('keeps the sill height, which both modules measure from the same line', () => {
    const openings = groundStorey().openings ?? [];

    expect(openings[0]).toMatchObject({ kind: 'door', sillHeightMm: 0, swing: 'left' });
    expect(openings[1]).toMatchObject({
      kind: 'window',
      sillHeightMm: WINDOW_SILL_MM,
      swing: 'sliding',
      widthMm: WINDOW_WIDTH_MM,
      heightMm: WINDOW_HEIGHT_MM,
    });
  });

  it('drops the review metadata the geometry has no place for', () => {
    const door = attachedOnly(groundStorey().openings)[0];

    expect(Object.keys(door ?? {}).sort()).toEqual(
      [
        'id',
        'kind',
        'widthMm',
        'heightMm',
        'sillHeightMm',
        'swing',
        'wallId',
        'relativePosition',
      ].sort(),
    );
  });

  it('folds an opening traced past the end of its wall back onto it', () => {
    const graph = withOpening(createGraph(), DOOR, { offsetMm: WALL_LENGTH_MM });
    const door = attachedOnly(groundStorey(normalizedGraph(graph)).openings)[0];

    expect(door?.relativePosition).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Rooms.                                                                      */
/* -------------------------------------------------------------------------- */

describe('rooms', () => {
  it('keeps the outline and nothing else', () => {
    const room = groundStorey().rooms[0];

    expect(room).toEqual({
      id: MAIN_ROOM,
      outline: [
        { x: 0, y: 0 },
        { x: ROOM_WIDTH_MM, y: 0 },
        { x: ROOM_WIDTH_MM, y: ROOM_DEPTH_MM },
        { x: 0, y: ROOM_DEPTH_MM },
      ],
    });
  });
});

/* -------------------------------------------------------------------------- */
/* No such storey.                                                             */
/* -------------------------------------------------------------------------- */

describe('a level that is not there', () => {
  it('returns null rather than an empty storey', () => {
    expect(toBuildFloorInput(normalizedGraph(), MISSING_LEVEL)).toBeNull();
  });

  it('returns null when the id is held by something that is not a level', () => {
    const spatial = normalizedGraph();
    const wall = spatial.byId[LOAD_WALL];

    if (wall === undefined) {
      throw new Error('fixture: the load-bearing wall is missing');
    }

    const disguised: NormalizedSpatial = {
      ...spatial,
      byId: { ...spatial.byId, [MISSING_LEVEL]: wall },
    };

    expect(toBuildFloorInput(disguised, MISSING_LEVEL)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* A storey that cannot be measured.                                           */
/* -------------------------------------------------------------------------- */

describe('a broken index', () => {
  it('throws when the level index points at an entity that is not there', () => {
    const spatial = normalizedGraph();
    const ghost = 'W-GHOSTWALL1' as EntityId;
    const broken: NormalizedSpatial = {
      ...spatial,
      byLevel: { ...spatial.byLevel, [GROUND]: [...(spatial.byLevel[GROUND] ?? []), ghost] },
    };

    expect(() => toBuildFloorInput(broken, GROUND)).toThrow(/missing entity W-GHOSTWALL1/);
  });

  it('throws when an opening on the storey names a wall that is not on it', () => {
    const spatial = normalizedGraph();
    const broken: NormalizedSpatial = {
      ...spatial,
      byLevel: {
        ...spatial.byLevel,
        [FIRST]: [...(spatial.byLevel[FIRST] ?? []), DOOR],
      },
    };

    expect(() => toBuildFloorInput(broken, FIRST)).toThrow(/names wall W-LOADBEAR01/);
  });
});

describe('a measurement that is not a number', () => {
  it('refuses a wall coordinate that is not finite', () => {
    const graph = withWall(createGraph(), LOAD_WALL, {
      centreline: { start: { x: Number.NaN, y: 0 }, end: { x: WALL_LENGTH_MM, y: 0 } },
    });

    expect(() => toBuildFloorInput(normalizedGraph(graph), GROUND)).toThrow(RangeError);
  });

  it('refuses a wall thickness that is not finite', () => {
    const graph = withWall(createGraph(), LOAD_WALL, { thicknessMm: Number.POSITIVE_INFINITY });

    expect(() => toBuildFloorInput(normalizedGraph(graph), GROUND)).toThrow(RangeError);
  });

  it('refuses a level elevation that is not finite', () => {
    const graph = createGraph();
    const broken: SpatialGraph = {
      ...graph,
      levels: graph.levels.map((level) =>
        level.id === GROUND ? { ...level, elevationMm: Number.NaN } : level,
      ),
    };

    expect(() => toBuildFloorInput(normalizedGraph(broken), GROUND)).toThrow(RangeError);
  });

  it('refuses a level height that is not finite', () => {
    const graph = createGraph();
    const broken: SpatialGraph = {
      ...graph,
      levels: graph.levels.map((level) =>
        level.id === GROUND ? { ...level, heightMm: Number.NaN } : level,
      ),
      walls: [],
      openings: [],
      rooms: [],
    };

    expect(() => toBuildFloorInput(normalizedGraph(broken), GROUND)).toThrow(RangeError);
  });

  it('refuses a room corner that is not finite', () => {
    const graph = withRoom(createGraph(), {
      outline: [
        { x: 0, y: 0 },
        { x: Number.NaN, y: 0 },
        { x: ROOM_WIDTH_MM, y: ROOM_DEPTH_MM },
      ],
    });

    expect(() => toBuildFloorInput(normalizedGraph(graph), GROUND)).toThrow(RangeError);
  });

  it('refuses an opening offset that is not finite', () => {
    const graph = withOpening(createGraph(), DOOR, { offsetMm: Number.NaN });

    expect(() => toBuildFloorInput(normalizedGraph(graph), GROUND)).toThrow(RangeError);
  });

  it('refuses an opening height that is not finite', () => {
    const graph = withOpening(createGraph(), DOOR, { heightMm: Number.NEGATIVE_INFINITY });

    expect(() => toBuildFloorInput(normalizedGraph(graph), GROUND)).toThrow(RangeError);
  });

  it('refuses to place an opening along a wall of no length', () => {
    const graph = withWall(createGraph(), LOAD_WALL, {
      centreline: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    });

    expect(() => toBuildFloorInput(normalizedGraph(graph), GROUND)).toThrow(
      /W-LOADBEAR01, whose centreline has zero length/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* The standard sample.                                                        */
/* -------------------------------------------------------------------------- */

describe('the standard sample', () => {
  it('builds every storey of it', () => {
    const spatial = normalizeSpatial(createSampleBuilding());

    for (let index = 0; index < 4; index += 1) {
      const input = toBuildFloorInput(spatial, sampleLevelId(index));

      expect(input).not.toBeNull();
      expect(input?.walls.length).toBe(12);
      expect(input?.level.id).toBe(sampleLevelId(index));
    }
  });

  it('places every door and window of the sample on a wall of its own storey', () => {
    const spatial = normalizeSpatial(createSampleBuilding());
    const placed = [0, 1, 2, 3].flatMap((index) =>
      attachedOnly(toBuildFloorInput(spatial, sampleLevelId(index))?.openings),
    );

    expect(placed.length).toBe(SAMPLE_DOOR_COUNT + 7);
    expect(placed.every((opening) => opening.relativePosition >= 0)).toBe(true);
    expect(placed.every((opening) => opening.relativePosition <= 1)).toBe(true);
  });
});
