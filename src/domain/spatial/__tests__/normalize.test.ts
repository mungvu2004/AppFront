import { describe, expect, it } from 'vitest';

import { applyPatch, readEntity, type SpatialPatch } from '../applyPatch';
import {
  denormalizeSpatial,
  idsOnLevel,
  normalizeSpatial,
  type NormalizedSpatial,
} from '../normalize';
import type {
  Axis,
  Dimension,
  DimensionId,
  Furniture,
  FurnitureId,
  Level,
  LevelId,
  Opening,
  OpeningId,
  Room,
  RoomId,
  SpatialGraph,
  Wall,
  WallId,
} from '../types';

// Standard sample dataset: 48 walls, 21 objects (9 doors + 7 windows +
// 5 furniture), 34 dimensions, 14 rooms, 4 levels, 248,60 m² in total.
const LEVEL_COUNT = 4;
const WALL_COUNT = 48;
const DOOR_COUNT = 9;
const WINDOW_COUNT = 7;
const FURNITURE_COUNT = 5;
const DIMENSION_COUNT = 34;
const ROOM_COUNT = 14;
const AXIS_COUNT = 4;
const SMALL_ROOM_AREA_M2 = 17;
const LARGE_ROOM_AREA_M2 = 27.6;
const TOTAL_AREA_M2 = 248.6;

const LEVEL_HEIGHT_MM = 3600;
const WALL_THICKNESS_MM = 220;
const DOOR_WIDTH_MM = 900;
const WINDOW_WIDTH_MM = 1200;

const pad = (value: number): string => String(value).padStart(6, '0');

const levelIdAt = (index: number): LevelId => `L-LEVEL${pad(index)}`;
const wallIdAt = (index: number): WallId => `W-WALL${pad(index)}0`;
const doorIdAt = (index: number): OpeningId => `D-DOOR${pad(index)}0`;
const windowIdAt = (index: number): OpeningId => `D-WNDW${pad(index)}0`;
const furnitureIdAt = (index: number): FurnitureId => `F-FURN${pad(index)}0`;
const roomIdAt = (index: number): RoomId => `R-ROOM${pad(index)}0`;
const dimensionIdAt = (index: number): DimensionId => `M-DIMN${pad(index)}0`;

const reviewedByAi = { confidence: 0.82, reviewed: false, source: 'ai' } as const;
const reviewedByHuman = { confidence: 1, reviewed: true, source: 'human' } as const;

const levelOf = (index: number): LevelId => levelIdAt(index % LEVEL_COUNT);

const buildLevels = (): Level[] =>
  Array.from({ length: LEVEL_COUNT }, (_unused, index) => ({
    ...reviewedByHuman,
    elevationMm: index * LEVEL_HEIGHT_MM,
    heightMm: LEVEL_HEIGHT_MM,
    id: levelIdAt(index),
    name: `Level ${index}`,
    order: index,
  }));

const buildWalls = (): Wall[] =>
  Array.from({ length: WALL_COUNT }, (_unused, index) => ({
    ...reviewedByAi,
    centreline: {
      end: { x: (index + 1) * 1000, y: 0 },
      start: { x: index * 1000, y: 0 },
    },
    heightMm: LEVEL_HEIGHT_MM,
    id: wallIdAt(index),
    kind: 'partition' as const,
    levelId: levelOf(index),
    openingIds: [],
    thicknessMm: WALL_THICKNESS_MM,
  }));

const buildOpenings = (walls: Wall[]): Opening[] => {
  const openings: Opening[] = [];

  for (let index = 0; index < DOOR_COUNT; index += 1) {
    openings.push({
      ...reviewedByAi,
      heightMm: 2200,
      id: doorIdAt(index),
      kind: 'door',
      offsetMm: 300,
      sillHeightMm: 0,
      swing: 'left',
      wallId: wallIdAt(index),
      widthMm: DOOR_WIDTH_MM,
    });
  }

  for (let index = 0; index < WINDOW_COUNT; index += 1) {
    openings.push({
      ...reviewedByAi,
      heightMm: 1400,
      id: windowIdAt(index),
      kind: 'window',
      offsetMm: 500,
      sillHeightMm: 900,
      swing: 'sliding',
      wallId: wallIdAt(DOOR_COUNT + index),
      widthMm: WINDOW_WIDTH_MM,
    });
  }

  for (const opening of openings) {
    const wall = walls.find((candidate) => candidate.id === opening.wallId);

    if (wall === undefined) {
      throw new Error(`fixture: opening ${opening.id} has no wall`);
    }

    wall.openingIds = [...wall.openingIds, opening.id];
  }

  return openings;
};

const buildFurniture = (): Furniture[] =>
  Array.from({ length: FURNITURE_COUNT }, (_unused, index) => ({
    ...reviewedByAi,
    boundingBox: {
      max: { x: index * 1000 + 800, y: 800 },
      min: { x: index * 1000, y: 0 },
    },
    centre: { x: index * 1000 + 400, y: 400 },
    id: furnitureIdAt(index),
    kind: 'table' as const,
    levelId: levelOf(index),
    rotationDeg: 0,
  }));

const buildRooms = (): Room[] =>
  Array.from({ length: ROOM_COUNT }, (_unused, index) => ({
    ...reviewedByHuman,
    areaM2: index === ROOM_COUNT - 1 ? LARGE_ROOM_AREA_M2 : SMALL_ROOM_AREA_M2,
    id: roomIdAt(index),
    levelId: levelOf(index),
    name: `Room ${index}`,
    outline: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 4250 },
      { x: 0, y: 4250 },
    ],
    usage: 'bedroom' as const,
    wallIds: [wallIdAt(index)],
  }));

const buildAxes = (): Axis[] =>
  Array.from({ length: AXIS_COUNT }, (_unused, index) => ({
    ...reviewedByHuman,
    direction: 'horizontal' as const,
    id: `A-AXIS${pad(index)}0` as const,
    label: String.fromCharCode(65 + index),
    levelId: levelOf(index),
    line: {
      end: { x: 48_000, y: index * 3000 },
      start: { x: 0, y: index * 3000 },
    },
  }));

const buildDimensions = (): Dimension[] =>
  Array.from({ length: DIMENSION_COUNT }, (_unused, index) => ({
    ...reviewedByAi,
    id: dimensionIdAt(index),
    kind: 'linear' as const,
    levelId: levelOf(index),
    line: {
      end: { x: (index + 1) * 1000, y: -500 },
      start: { x: index * 1000, y: -500 },
    },
    referenceIds: [wallIdAt(index)],
    valueMm: 1000,
  }));

const buildGraph = (): SpatialGraph => {
  const walls = buildWalls();
  const openings = buildOpenings(walls);

  return {
    axes: buildAxes(),
    building: {
      ...reviewedByHuman,
      datumElevationMm: 0,
      grossFloorAreaM2: TOTAL_AREA_M2,
      name: 'Hoang Anh apartment',
    },
    dimensions: buildDimensions(),
    furniture: buildFurniture(),
    levels: buildLevels(),
    notes: [
      {
        ...reviewedByHuman,
        authorId: 'U-1',
        body: 'Checked against the surveyed plan.',
        createdAt: '2026-08-13T09:00:00+07:00',
        entityId: wallIdAt(0),
        id: 'note-1',
      },
    ],
    openings,
    rooms: buildRooms(),
    walls,
  };
};

const firstWallOnLevel = (graph: SpatialGraph, levelId: LevelId): Wall => {
  const wall = graph.walls.find((candidate) => candidate.levelId === levelId);

  if (wall === undefined) {
    throw new Error(`fixture: level ${levelId} has no wall`);
  }

  return wall;
};

const requireWall = (normalized: NormalizedSpatial, id: WallId): Wall => {
  const wall = readEntity(normalized, 'wall', id);

  if (wall === null) {
    throw new Error(`expected wall ${id} to be present`);
  }

  return wall;
};

describe('the standard sample dataset', () => {
  it('holds 48 walls, 21 objects, 34 dimensions, 14 rooms, 4 levels and 248,60 m²', () => {
    const graph = buildGraph();
    const doors = graph.openings.filter((opening) => opening.kind === 'door');
    const windows = graph.openings.filter((opening) => opening.kind === 'window');
    const totalAreaM2 = graph.rooms.reduce((sum, room) => sum + room.areaM2, 0);

    expect(graph.walls).toHaveLength(48);
    expect(doors).toHaveLength(9);
    expect(windows).toHaveLength(7);
    expect(graph.furniture).toHaveLength(5);
    expect(doors.length + windows.length + graph.furniture.length).toBe(21);
    expect(graph.dimensions).toHaveLength(34);
    expect(graph.rooms).toHaveLength(14);
    expect(graph.levels).toHaveLength(4);
    expect(totalAreaM2).toBeCloseTo(TOTAL_AREA_M2, 2);
  });
});

describe('normalizeSpatial', () => {
  it('indexes every entity by id', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const expectedCount =
      LEVEL_COUNT + WALL_COUNT + DOOR_COUNT + WINDOW_COUNT + FURNITURE_COUNT + ROOM_COUNT + AXIS_COUNT + DIMENSION_COUNT;

    expect(Object.keys(normalized.byId)).toHaveLength(expectedCount);
    expect(normalized.byId[wallIdAt(0)]).toBe(graph.walls[0]);
  });

  it('keeps the original array order in byKind', () => {
    const normalized = normalizeSpatial(buildGraph());

    expect(normalized.byKind.wall).toEqual(Array.from({ length: WALL_COUNT }, (_unused, index) => wallIdAt(index)));
    expect(normalized.byKind.level).toEqual(
      Array.from({ length: LEVEL_COUNT }, (_unused, index) => levelIdAt(index)),
    );
  });

  it('places an opening on the level of the wall it is cut into', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const door = graph.openings[0];
    const hostWall = requireWall(normalized, door!.wallId);

    expect(idsOnLevel(normalized, hostWall.levelId)).toContain(door!.id);
  });

  it('gives every level a bucket, even an empty one', () => {
    const normalized = normalizeSpatial({ ...buildGraph(), axes: [], dimensions: [], furniture: [], openings: [], rooms: [], walls: [] });

    for (let index = 0; index < LEVEL_COUNT; index += 1) {
      expect(idsOnLevel(normalized, levelIdAt(index))).toEqual([]);
    }
  });

  it('does not mutate the graph it is given', () => {
    const graph = buildGraph();
    const before = structuredClone(graph);

    normalizeSpatial(graph);

    expect(graph).toEqual(before);
  });
});

describe('denormalizeSpatial', () => {
  it('rebuilds the 4-level graph exactly, round trip', () => {
    const graph = buildGraph();

    expect(denormalizeSpatial(normalizeSpatial(graph))).toEqual(graph);
  });

  it('survives repeated round trips unchanged', () => {
    const graph = buildGraph();
    const once = denormalizeSpatial(normalizeSpatial(graph));
    const twice = denormalizeSpatial(normalizeSpatial(once));

    expect(twice).toEqual(graph);
  });

  it('carries the building and the notes over by reference', () => {
    const graph = buildGraph();
    const rebuilt = denormalizeSpatial(normalizeSpatial(graph));

    expect(rebuilt.building).toBe(graph.building);
    expect(rebuilt.notes).toBe(graph.notes);
  });

  it('reports an index that points at a missing entity', () => {
    const normalized = normalizeSpatial(buildGraph());
    const broken: NormalizedSpatial = { ...normalized, byId: {} };

    expect(() => denormalizeSpatial(broken)).toThrow(/missing entity/);
  });
});

describe('applyPatch', () => {
  it('returns the very same object when there is nothing to patch', () => {
    const normalized = normalizeSpatial(buildGraph());

    expect(applyPatch(normalized, [])).toBe(normalized);
  });

  it('returns the very same object when a change matches the current value', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const wall = firstWallOnLevel(graph, levelIdAt(0));

    const patched = applyPatch(normalized, [
      { changes: { thicknessMm: wall.thicknessMm }, id: wall.id, kind: 'wall', op: 'update' },
    ]);

    expect(patched).toBe(normalized);
  });

  it('leaves every other level untouched when one wall is patched', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const patchedWall = firstWallOnLevel(graph, levelIdAt(0));

    const patched = applyPatch(normalized, [
      { changes: { thicknessMm: 330 }, id: patchedWall.id, kind: 'wall', op: 'update' },
    ]);

    for (let index = 1; index < LEVEL_COUNT; index += 1) {
      expect(patched.byLevel[levelIdAt(index)]).toBe(normalized.byLevel[levelIdAt(index)]);
    }

    // The wall stayed on its level, so not even its own bucket is rebuilt.
    expect(patched.byLevel).toBe(normalized.byLevel);
    expect(patched.byKind).toBe(normalized.byKind);
  });

  it('changes the reference of the patched entity only', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const patchedWall = firstWallOnLevel(graph, levelIdAt(0));
    const neighbourWall = firstWallOnLevel(graph, levelIdAt(1));

    const patched = applyPatch(normalized, [
      { changes: { thicknessMm: 330 }, id: patchedWall.id, kind: 'wall', op: 'update' },
    ]);

    expect(patched.byId[patchedWall.id]).not.toBe(normalized.byId[patchedWall.id]);
    expect(requireWall(patched, patchedWall.id).thicknessMm).toBe(330);
    expect(patched.byId[neighbourWall.id]).toBe(normalized.byId[neighbourWall.id]);
    expect(patched.building).toBe(normalized.building);
    expect(patched.notes).toBe(normalized.notes);
  });

  it('does not mutate the normalized graph it is given', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const wall = firstWallOnLevel(graph, levelIdAt(0));
    const before = structuredClone(normalized);

    applyPatch(normalized, [{ changes: { thicknessMm: 330 }, id: wall.id, kind: 'wall', op: 'update' }]);

    expect(normalized).toEqual(before);
    expect(requireWall(normalized, wall.id).thicknessMm).toBe(WALL_THICKNESS_MM);
  });

  it('moves a wall and its openings when the wall changes level', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const movedWall = requireWall(normalized, wallIdAt(0));
    const openingId = movedWall.openingIds[0];
    const target = levelIdAt(2);
    const untouched = levelIdAt(3);

    expect(openingId).toBeDefined();

    const patched = applyPatch(normalized, [
      { changes: { levelId: target }, id: movedWall.id, kind: 'wall', op: 'update' },
    ]);

    expect(idsOnLevel(patched, movedWall.levelId)).not.toContain(movedWall.id);
    expect(idsOnLevel(patched, movedWall.levelId)).not.toContain(openingId);
    expect(idsOnLevel(patched, target)).toContain(movedWall.id);
    expect(idsOnLevel(patched, target)).toContain(openingId);
    expect(patched.byLevel[untouched]).toBe(normalized.byLevel[untouched]);
  });

  it('adds an entity to byId, byKind and the level bucket', () => {
    const normalized = normalizeSpatial(buildGraph());
    const added: Room = {
      ...reviewedByHuman,
      areaM2: SMALL_ROOM_AREA_M2,
      id: roomIdAt(ROOM_COUNT),
      levelId: levelIdAt(1),
      name: 'Added room',
      outline: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
      ],
      usage: 'utility',
      wallIds: [],
    };

    const patched = applyPatch(normalized, [{ entity: added, kind: 'room', op: 'add' }]);

    expect(patched.byId[added.id]).toBe(added);
    expect(patched.byKind.room).toHaveLength(ROOM_COUNT + 1);
    expect(idsOnLevel(patched, levelIdAt(1))).toContain(added.id);
    expect(patched.byKind.wall).toBe(normalized.byKind.wall);
    expect(patched.byLevel[levelIdAt(2)]).toBe(normalized.byLevel[levelIdAt(2)]);
  });

  it('removes an entity from every index', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const removed = firstWallOnLevel(graph, levelIdAt(0));

    const patched = applyPatch(normalized, [{ id: removed.id, kind: 'wall', op: 'remove' }]);

    expect(patched.byId[removed.id]).toBeUndefined();
    expect(patched.byKind.wall).not.toContain(removed.id);
    expect(idsOnLevel(patched, removed.levelId)).not.toContain(removed.id);
    expect(normalized.byId[removed.id]).toBe(removed);
  });

  it('ignores an update or a remove aimed at an unknown id', () => {
    const normalized = normalizeSpatial(buildGraph());
    const unknownId = wallIdAt(WALL_COUNT + 1);

    const patches: SpatialPatch[] = [
      { changes: { thicknessMm: 330 }, id: unknownId, kind: 'wall', op: 'update' },
      { id: unknownId, kind: 'wall', op: 'remove' },
    ];

    expect(applyPatch(normalized, patches)).toBe(normalized);
  });

  it('applies a batch of patches in order', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const wall = firstWallOnLevel(graph, levelIdAt(0));

    const patched = applyPatch(normalized, [
      { changes: { thicknessMm: 330 }, id: wall.id, kind: 'wall', op: 'update' },
      { changes: { thicknessMm: 110, kind: 'loadBearing' }, id: wall.id, kind: 'wall', op: 'update' },
    ]);

    const result = requireWall(patched, wall.id);

    expect(result.thicknessMm).toBe(110);
    expect(result.kind).toBe('loadBearing');
  });

  it('keeps the graph round-trippable after patching', () => {
    const graph = buildGraph();
    const normalized = normalizeSpatial(graph);
    const wall = firstWallOnLevel(graph, levelIdAt(0));

    const patched = applyPatch(normalized, [
      { changes: { thicknessMm: 330 }, id: wall.id, kind: 'wall', op: 'update' },
    ]);
    const rebuilt = denormalizeSpatial(patched);

    expect(rebuilt.walls).toHaveLength(WALL_COUNT);
    expect(rebuilt.walls.map((item) => item.id)).toEqual(graph.walls.map((item) => item.id));
    expect(rebuilt.walls[0]?.thicknessMm).toBe(330);
    expect(normalizeSpatial(rebuilt).byId[wall.id]).toEqual(patched.byId[wall.id]);
  });
});
