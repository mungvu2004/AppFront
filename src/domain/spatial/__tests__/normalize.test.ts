import { describe, expect, it } from 'vitest';

import {
  createSampleBuilding,
  SAMPLE_AXIS_COUNT,
  SAMPLE_DIMENSION_COUNT,
  SAMPLE_DOOR_COUNT,
  SAMPLE_FURNITURE_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_WALL_COUNT,
  SAMPLE_WINDOW_COUNT,
  sampleLevelId,
  sampleRoomId,
  sampleWallId,
} from '../__fixtures__/sampleBuilding';
import { applyPatch, readEntity, type SpatialPatch } from '../applyPatch';
import {
  denormalizeSpatial,
  idsOnLevel,
  normalizeSpatial,
  type NormalizedSpatial,
} from '../normalize';
import type { LevelId, Room, SpatialGraph, Wall, WallId } from '../types';

// The standard sample dataset lives in __fixtures__/sampleBuilding; its counts
// and total area are asserted in integrity.test.ts.
const LEVEL_COUNT = SAMPLE_LEVEL_COUNT;
const WALL_COUNT = SAMPLE_WALL_COUNT;
const DOOR_COUNT = SAMPLE_DOOR_COUNT;
const WINDOW_COUNT = SAMPLE_WINDOW_COUNT;
const FURNITURE_COUNT = SAMPLE_FURNITURE_COUNT;
const ROOM_COUNT = SAMPLE_ROOM_COUNT;
const AXIS_COUNT = SAMPLE_AXIS_COUNT;
const DIMENSION_COUNT = SAMPLE_DIMENSION_COUNT;

const WALL_THICKNESS_MM = 220;
const SMALL_ROOM_AREA_M2 = 17;

const buildGraph = createSampleBuilding;
const levelIdAt = sampleLevelId;
const wallIdAt = sampleWallId;
const roomIdAt = sampleRoomId;

const reviewedByHuman = { confidence: 1, reviewed: true, source: 'human' } as const;

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
