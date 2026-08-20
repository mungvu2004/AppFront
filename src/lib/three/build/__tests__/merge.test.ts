import type {
  LOD} from 'three';
import {
  BoxGeometry,
  BufferGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { describe, expect, it } from 'vitest';

import { millimetres, type Millimetres } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { AttachedOpening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import {
  sampleDoorId,
  sampleFurnitureId,
  sampleLevelId,
  sampleRoomId,
  sampleWallId,
} from '@/domain/spatial/__fixtures__/sampleBuilding';

import { readPartData, tagPart, type BuildPartKind } from '../scene';
import { buildWallMesh } from '../wall';
import { buildFloorMesh, type BuildFloorInput, type BuildableLevel, type BuildableRoom } from '../floor';
import {
  BLOCK_DISTANCE_M,
  buildFloorAtDetail,
  buildFloorLod,
  detailLevelAt,
  readDetail,
  REDUCED_DISTANCE_M,
  type DetailLevel,
} from '../lod';
import {
  collectMeshes,
  entityAtHit,
  locateParts,
  mergeByMaterial,
  mergeGroup,
  partAtVertex,
  selectionRanges,
  type MergeResult,
  type MergedBatch,
} from '../merge';

/* -------------------------------------------------------------------------- */
/* Fixtures: the standard sample plan, 48 / 21 / 34 / 14 / 4.                  */
/* -------------------------------------------------------------------------- */

/** Walls on the standard storey. */
const WALL_COUNT = 48;

/** Openings on the standard storey. */
const OPENING_COUNT = 34;

/** Rooms on the standard storey. */
const ROOM_COUNT = 14;

const LEVEL: BuildableLevel = {
  id: sampleLevelId(0),
  elevationMm: millimetres(0),
  heightMm: millimetres(3000),
};

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

/*
 * Ids come from the shared sample fixture rather than being spelt out here.
 * `domain/spatial/ids` will only name a kind for an id whose body is at least
 * ten characters of `[0-9A-Z]`, and everything downstream that speaks the
 * selection vocabulary — `selectableKindOf`, `isSelectable`, the hit test over
 * this very range table — asks it. A hand-shortened `W-01` batches and reads
 * back perfectly here and then resolves to no layer at all out there, which
 * looks exactly like a broken range table and is not one.
 */

/** How the forty-eight wall runs are laid out: eight bays of six. */
const WALL_ROWS = 6;
const BAY_WIDTH_MM = 5000;
const BAY_DEPTH_MM = 6000;
const WALL_LENGTH_MM = 4000;

/** Forty-eight wall runs on a 39 × 30 m footprint, each 4 m long, 200 mm thick. */
const WALLS: readonly Wall[] = Array.from({ length: WALL_COUNT }, (_unused, index): Wall => {
  const alongMm = Math.floor(index / WALL_ROWS) * BAY_WIDTH_MM;
  const acrossMm = (index % WALL_ROWS) * BAY_DEPTH_MM;

  return {
    id: sampleWallId(index),
    kind: 'partition',
    centreline: {
      start: pointAt(alongMm, acrossMm),
      end: pointAt(alongMm + WALL_LENGTH_MM, acrossMm),
    },
    thicknessMm: millimetres(200),
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
});

/** Thirty-four doors, one on each of the first thirty-four walls. */
const OPENINGS: readonly AttachedOpening[] = Array.from(
  { length: OPENING_COUNT },
  (_unused, index): AttachedOpening => ({
    id: sampleDoorId(index),
    kind: 'door',
    widthMm: millimetres(900),
    heightMm: millimetres(2100),
    sillHeightMm: millimetres(0),
    swing: 'left',
    wallId: sampleWallId(index),
    relativePosition: 0.5,
  }),
);

/** Fourteen rooms, each 5 × 4 m. */
const ROOMS: readonly BuildableRoom[] = Array.from(
  { length: ROOM_COUNT },
  (_unused, index): BuildableRoom => {
    const offsetMm = index * 6000;
    return {
      id: sampleRoomId(index),
      outline: [
        pointAt(offsetMm, 0),
        pointAt(offsetMm + 5000, 0),
        pointAt(offsetMm + 5000, 4000),
        pointAt(offsetMm, 4000),
      ],
    };
  },
);

const STOREY: BuildFloorInput = {
  level: LEVEL,
  walls: WALLS,
  rooms: ROOMS,
  openings: OPENINGS,
};

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

function namedMaterial(name: string): Material {
  const material = new MeshStandardMaterial();
  material.name = name;
  return material;
}

/** One shared material per part kind, the way a colour token would be shared. */
function paintByKind(meshes: readonly Mesh[]): readonly Mesh[] {
  const byKind = new Map<BuildPartKind, Material>();

  for (const mesh of meshes) {
    const kind = readPartData(mesh)?.kind;
    if (kind === undefined) {
      continue;
    }
    const material = byKind.get(kind) ?? namedMaterial(kind);
    byKind.set(kind, material);
    mesh.material = material;
  }

  return meshes;
}

/** Every wall of the standard storey as its own mesh, all sharing one material. */
function buildWallMeshes(): readonly Mesh[] {
  const material = namedMaterial('wall');

  return WALLS.map((wall) => {
    const mesh = buildWallMesh(wall, { levelId: LEVEL.id, openings: OPENINGS });
    mesh.material = material;
    return mesh;
  });
}

/** A chair placed several times, every copy sharing one geometry object. */
function buildChairs(count: number): {
  readonly geometry: BufferGeometry;
  readonly meshes: readonly Mesh[];
} {
  const geometry = new BoxGeometry(0.5, 0.9, 0.5);
  const material = namedMaterial('furniture');

  const meshes = Array.from({ length: count }, (_unused, index) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(index * 1.5, 0, 2);
    return tagPart(mesh, {
      kind: 'furniture',
      entityId: sampleFurnitureId(index),
      levelId: LEVEL.id,
    });
  });

  return { geometry, meshes };
}

function mergedBatchesOf(result: MergeResult): readonly MergedBatch[] {
  return result.batches.filter((batch): batch is MergedBatch => batch.kind === 'merged');
}

function vertexCountOf(mesh: Mesh): number {
  return mesh.geometry.getAttribute('position').count;
}

function kindCounts(root: Object3D): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const mesh of collectMeshes(root)) {
    const kind = readPartData(mesh)?.kind ?? 'untagged';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

/** The one mesh in a subtree that stands for the entity given. */
function meshFor(root: Object3D, entityId: string): Mesh {
  const found = collectMeshes(root).find((mesh) => readPartData(mesh)?.entityId === entityId);
  if (found === undefined) {
    throw new Error(`No mesh in the group stands for ${entityId}.`);
  }
  return found;
}

function triangleCount(mesh: Mesh): number {
  const index = mesh.geometry.getIndex();
  return index === null ? vertexCountOf(mesh) / 3 : index.count / 3;
}

/**
 * Tolerance, in scene units.
 *
 * Four decimals is a tenth of a millimetre. Positions live in a `Float32Array`,
 * whose relative precision runs out around the seventh digit, so a coordinate
 * forty metres from the origin cannot be checked much tighter than this — and a
 * tenth of a millimetre is already an order of magnitude below the finest number
 * a drawing carries.
 */
const PLACES = 4;

/* -------------------------------------------------------------------------- */
/* Merging.                                                                    */
/* -------------------------------------------------------------------------- */

describe('mergeByMaterial', () => {
  it('gathers 48 walls into at most six meshes and still traces all 48 ids', () => {
    const walls = buildWallMeshes();
    const result = mergeByMaterial(walls);

    expect(walls).toHaveLength(WALL_COUNT);
    expect(result.batches.length).toBeLessThanOrEqual(6);
    expect(result.skipped).toEqual([]);
    expect(result.index.size).toBe(WALL_COUNT);

    for (const wall of WALLS) {
      expect(locateParts(result, wall.id)).toHaveLength(1);
    }
  });

  it('answers a hit on the merged mesh with the wall that was hit', () => {
    const result = mergeByMaterial(buildWallMeshes());
    const batch = mergedBatchesOf(result)[0];

    expect(batch).toBeDefined();
    if (batch === undefined) {
      return;
    }

    expect(batch.parts).toHaveLength(WALL_COUNT);

    for (const part of batch.parts) {
      const first = part.start;
      const middle = part.start + Math.floor(part.count / 2);
      const last = part.start + part.count - 1;

      for (const vertexIndex of [first, middle, last]) {
        expect(entityAtHit(result, { object: batch.mesh, face: { a: vertexIndex } })).toBe(
          part.entityId,
        );
      }
    }
  });

  it('lays the range table out end to end, covering the buffer exactly once', () => {
    const batch = mergedBatchesOf(mergeByMaterial(buildWallMeshes()))[0];

    expect(batch).toBeDefined();
    if (batch === undefined) {
      return;
    }

    let expectedStart = 0;
    for (const part of batch.parts) {
      expect(part.start).toBe(expectedStart);
      expect(part.count).toBeGreaterThan(0);
      expectedStart += part.count;
    }

    expect(expectedStart).toBe(vertexCountOf(batch.mesh));
  });

  it('keeps every vertex, and keeps it where it was', () => {
    const walls = buildWallMeshes();
    const batch = mergedBatchesOf(mergeByMaterial(walls))[0];

    expect(batch).toBeDefined();
    if (batch === undefined) {
      return;
    }

    const sourceVertices = walls.reduce((total, mesh) => total + vertexCountOf(mesh), 0);
    expect(vertexCountOf(batch.mesh)).toBe(sourceVertices);

    // The merged buffer covers the whole footprint: eight bays across, six deep,
    // plus half a wall thickness beyond the outermost centreline.
    const box = batch.mesh.geometry.boundingBox;
    expect(box?.min.x).toBeCloseTo(0, PLACES);
    expect(box?.max.x).toBeCloseTo(35 + 4, PLACES);
    expect(box?.min.z).toBeCloseTo(-0.1, PLACES);
    expect(box?.max.z).toBeCloseTo(30 + 0.1, PLACES);
  });

  it('keeps the material it merged by, and one batch per material', () => {
    const result = mergeGroup(buildFloorMesh(STOREY));
    // Every mesh still carries the per-mesh default material three hands out.
    expect(result.batches.length).toBe(collectMeshes(buildFloorMesh(STOREY)).length);

    const painted = mergeByMaterial(paintByKind(collectMeshes(buildFloorMesh(STOREY))));
    expect(painted.batches.map((batch) => batch.key).sort()).toEqual([
      'ceiling',
      'floorSlab',
      'opening',
      'wall',
    ]);
  });

  it('finds both meshes a room is drawn by', () => {
    const result = mergeByMaterial(paintByKind(collectMeshes(buildFloorMesh(STOREY))));
    const parts = locateParts(result, sampleRoomId(0));

    expect(parts.map((entry) => entry.part.kind).sort()).toEqual(['ceiling', 'floorSlab']);
  });

  it('writes nothing to the meshes it was given', () => {
    const walls = buildWallMeshes();
    const before = walls.map((mesh) => ({
      geometry: mesh.geometry,
      material: mesh.material,
      vertices: vertexCountOf(mesh),
      firstX: mesh.geometry.getAttribute('position').getX(0),
      userData: JSON.stringify(mesh.userData),
    }));

    const result = mergeByMaterial(walls);

    walls.forEach((mesh, index) => {
      const snapshot = before[index];
      expect(snapshot).toBeDefined();
      expect(mesh.geometry).toBe(snapshot?.geometry);
      expect(mesh.material).toBe(snapshot?.material);
      expect(vertexCountOf(mesh)).toBe(snapshot?.vertices);
      expect(mesh.geometry.getAttribute('position').getX(0)).toBe(snapshot?.firstX);
      expect(JSON.stringify(mesh.userData)).toBe(snapshot?.userData);
    });

    const batch = mergedBatchesOf(result)[0];
    expect(batch?.mesh.geometry).not.toBe(walls[0]?.geometry);
  });

  it('leaves indexed geometry indexed, and where it was', () => {
    // `toNonIndexed` hands back the same object for a geometry that is already
    // non-indexed, so the flattening step has to clone before it transforms.
    const { meshes } = buildChairs(2);
    const source = meshes[0];

    expect(source).toBeDefined();
    if (source === undefined) {
      return;
    }

    const indexBefore = source.geometry.getIndex()?.count;
    const firstX = source.geometry.getAttribute('position').getX(0);

    mergeByMaterial(meshes, { instanceThreshold: 5 });

    expect(source.geometry.getIndex()?.count).toBe(indexBefore);
    expect(source.geometry.getAttribute('position').getX(0)).toBe(firstX);
    expect(source.position.x).toBe(0);
  });

  it('reports a mesh it cannot batch instead of dropping it quietly', () => {
    const untagged = new Mesh(new BoxGeometry(1, 1, 1), namedMaterial('wall'));
    untagged.name = 'stray';

    const twoMaterials = new Mesh(new BoxGeometry(1, 1, 1), [
      namedMaterial('wall'),
      namedMaterial('opening'),
    ]);
    tagPart(twoMaterials, { kind: 'wall', entityId: sampleWallId(98), levelId: sampleLevelId(0) });

    const empty = tagPart(new Mesh(new BufferGeometry(), namedMaterial('wall')), {
      kind: 'wall',
      entityId: sampleWallId(97),
      levelId: sampleLevelId(0),
    });

    const result = mergeByMaterial([untagged, twoMaterials, empty]);

    expect(result.batches).toEqual([]);
    expect(result.skipped.map((entry) => entry.reason)).toEqual([
      'noPartData',
      'multipleMaterials',
      'noGeometry',
    ]);
    expect(result.skipped[0]?.message).toContain('stray');
  });

  it('refuses an instance threshold below two', () => {
    expect(() => mergeByMaterial([], { instanceThreshold: 1 })).toThrow(RangeError);
    expect(() => mergeByMaterial([], { instanceThreshold: 2.5 })).toThrow(RangeError);
  });
});

/* -------------------------------------------------------------------------- */
/* Instancing.                                                                 */
/* -------------------------------------------------------------------------- */

describe('mergeByMaterial instancing', () => {
  it('draws repeated furniture once per placement, without copying it', () => {
    const { geometry, meshes } = buildChairs(4);
    const result = mergeByMaterial(meshes);

    expect(result.batches).toHaveLength(1);
    const batch = result.batches[0];
    expect(batch?.kind).toBe('instanced');

    if (batch === undefined || batch.kind !== 'instanced') {
      return;
    }

    // The very same geometry object: nothing was duplicated into a buffer.
    expect(batch.mesh.geometry).toBe(geometry);
    expect(batch.mesh.count).toBe(4);
    expect(batch.parts.map((part) => part.entityId)).toEqual([
      sampleFurnitureId(0),
      sampleFurnitureId(1),
      sampleFurnitureId(2),
      sampleFurnitureId(3),
    ]);
  });

  it('carries each placement across as its own matrix', () => {
    const { meshes } = buildChairs(4);
    const batch = mergeByMaterial(meshes).batches[0];

    if (batch === undefined || batch.kind !== 'instanced') {
      expect.unreachable('the chairs should have been instanced');
      return;
    }

    const placement = new Matrix4();

    meshes.forEach((mesh, instanceId) => {
      batch.mesh.getMatrixAt(instanceId, placement);
      const translation = new Vector3().setFromMatrixPosition(placement);

      expect(translation.x).toBeCloseTo(mesh.position.x, PLACES);
      expect(translation.y).toBeCloseTo(mesh.position.y, PLACES);
      expect(translation.z).toBeCloseTo(mesh.position.z, PLACES);
    });
  });

  it('answers a hit on an instanced batch with the placement that was hit', () => {
    const { meshes } = buildChairs(4);
    const result = mergeByMaterial(meshes);
    const batch = result.batches[0];

    if (batch === undefined) {
      expect.unreachable('there should be one batch');
      return;
    }

    expect(entityAtHit(result, { object: batch.mesh, instanceId: 2 })).toBe(sampleFurnitureId(2));
    expect(entityAtHit(result, { object: batch.mesh, instanceId: 9 })).toBeNull();
  });

  it('merges the copies instead when the threshold is above the repeat count', () => {
    const { meshes } = buildChairs(4);
    const result = mergeByMaterial(meshes, { instanceThreshold: 5 });

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0]?.kind).toBe('merged');
    expect(result.index.size).toBe(4);
  });

  it('keeps unique geometry merged and repeated geometry instanced, side by side', () => {
    const material = namedMaterial('shared');
    const walls = buildWallMeshes().map((mesh) => {
      mesh.material = material;
      return mesh;
    });
    const { meshes: chairs } = buildChairs(4);
    for (const chair of chairs) {
      chair.material = material;
    }

    const result = mergeByMaterial([...walls, ...chairs]);

    expect(result.batches.map((batch) => batch.kind).sort()).toEqual(['instanced', 'merged']);
    expect(result.index.size).toBe(WALL_COUNT + 4);
    expect(entityAtHit(result, { object: result.batches[0]?.mesh as Mesh, instanceId: 0 })).toBe(
      sampleFurnitureId(0),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Highlighting.                                                               */
/* -------------------------------------------------------------------------- */

describe('selectionRanges', () => {
  it('joins the spans of walls that sit side by side in the buffer', () => {
    const batch = mergedBatchesOf(mergeByMaterial(buildWallMeshes()))[0];

    if (batch === undefined) {
      expect.unreachable('there should be a merged batch');
      return;
    }

    const neighbours = selectionRanges(batch, [sampleWallId(0), sampleWallId(1), sampleWallId(2)]);
    expect(neighbours).toHaveLength(1);

    const first = batch.parts[0];
    const third = batch.parts[2];
    expect(neighbours[0]?.start).toBe(first?.start);
    expect(neighbours[0]?.count).toBe(
      (first?.count ?? 0) + (batch.parts[1]?.count ?? 0) + (third?.count ?? 0),
    );
  });

  it('keeps spans apart when the walls are not neighbours', () => {
    const batch = mergedBatchesOf(mergeByMaterial(buildWallMeshes()))[0];

    if (batch === undefined) {
      expect.unreachable('there should be a merged batch');
      return;
    }

    expect(selectionRanges(batch, [sampleWallId(0), sampleWallId(5)])).toHaveLength(2);
    expect(selectionRanges(batch, [])).toEqual([]);
    expect(selectionRanges(batch, [sampleRoomId(0)])).toEqual([]);
  });

  it('reads a vertex back to its part, and nothing outside the buffer', () => {
    const batch = mergedBatchesOf(mergeByMaterial(buildWallMeshes()))[0];

    if (batch === undefined) {
      expect.unreachable('there should be a merged batch');
      return;
    }

    expect(partAtVertex(batch, 0)?.entityId).toBe(sampleWallId(0));
    expect(partAtVertex(batch, vertexCountOf(batch.mesh) - 1)?.entityId).toBe(
      sampleWallId(WALL_COUNT - 1),
    );
    expect(partAtVertex(batch, vertexCountOf(batch.mesh))).toBeNull();
    expect(partAtVertex(batch, -1)).toBeNull();
  });

  it('falls back to an unbatched mesh own tag', () => {
    const result = mergeByMaterial([]);
    const loose = buildWallMesh(WALLS[0] as Wall, { levelId: LEVEL.id });

    expect(entityAtHit(result, { object: loose, face: { a: 0 } })).toBe(sampleWallId(0));
  });

  it('takes what a Raycaster hands back, with nothing reshaped on the way', () => {
    const result = mergeByMaterial(buildWallMeshes());
    const batch = mergedBatchesOf(result)[0];

    if (batch === undefined) {
      expect.unreachable('there should be a merged batch');
      return;
    }

    const caster = new Raycaster();

    // Straight down onto the first wall, which runs along x at z = 0. The door
    // cut into it stops at 2.1 m, so the top of the 3 m wall is solid here.
    caster.set(new Vector3(2, 10, 0), new Vector3(0, -1, 0));

    const nearest = caster.intersectObject(batch.mesh, false)[0];

    if (nearest === undefined) {
      expect.unreachable('the ray should have met the wall');
      return;
    }

    // The assertion that matters is the line itself: `nearest` is a real
    // `THREE.Intersection` and is passed with no cast and no rebuilt object.
    // Narrow `HitLike.face` back to `… | null` and this stops compiling, which
    // is the only way to catch it — every caller could still paper over it.
    expect(entityAtHit(result, nearest)).toBe(sampleWallId(0));
  });
});

/* -------------------------------------------------------------------------- */
/* Level of detail.                                                            */
/* -------------------------------------------------------------------------- */

describe('detailLevelAt', () => {
  it('changes rung exactly at 25 m', () => {
    expect(REDUCED_DISTANCE_M).toBe(25);
    expect(detailLevelAt(0)).toBe('full');
    expect(detailLevelAt(24.999)).toBe('full');
    expect(detailLevelAt(25)).toBe('reduced');
    expect(detailLevelAt(25.001)).toBe('reduced');
  });

  it('changes rung exactly at 60 m', () => {
    expect(BLOCK_DISTANCE_M).toBe(60);
    expect(detailLevelAt(59.999)).toBe('reduced');
    expect(detailLevelAt(60)).toBe('block');
    expect(detailLevelAt(1000)).toBe('block');
  });

  it('refuses a distance that is not a length', () => {
    expect(() => detailLevelAt(-1)).toThrow(RangeError);
    expect(() => detailLevelAt(Number.NaN)).toThrow(RangeError);
    expect(() => detailLevelAt(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('buildFloorAtDetail', () => {
  it('draws everything at full detail', () => {
    const counts = kindCounts(buildFloorAtDetail(STOREY, 'full'));

    expect(counts.get('wall')).toBe(WALL_COUNT);
    expect(counts.get('floorSlab')).toBe(ROOM_COUNT);
    expect(counts.get('ceiling')).toBe(ROOM_COUNT);
    expect(counts.get('opening')).toBe(OPENING_COUNT);
  });

  it('drops the leaves and the glazing but keeps the holes they sat in', () => {
    const reduced = buildFloorAtDetail(STOREY, 'reduced');
    const counts = kindCounts(reduced);

    expect(counts.get('opening')).toBeUndefined();
    expect(counts.get('wall')).toBe(WALL_COUNT);
    expect(counts.get('ceiling')).toBe(ROOM_COUNT);

    // A wall with a door cut in it has more triangles than a solid one.
    expect(triangleCount(meshFor(reduced, sampleWallId(0)))).toBeGreaterThan(12);
  });

  it('draws the massing only, with solid walls, at block detail', () => {
    const block = buildFloorAtDetail(STOREY, 'block');
    const counts = kindCounts(block);

    expect(counts.get('wall')).toBe(WALL_COUNT);
    expect(counts.get('floorSlab')).toBe(ROOM_COUNT);
    expect(counts.get('ceiling')).toBeUndefined();
    expect(counts.get('opening')).toBeUndefined();

    // No opening cut: a plain box of twelve triangles.
    expect(triangleCount(meshFor(block, sampleWallId(0)))).toBe(12);
  });

  it('keeps the level name and the reverse lookup at every rung', () => {
    for (const detail of ['full', 'reduced', 'block'] as const) {
      const group = buildFloorAtDetail(STOREY, detail);

      expect(group.name).toBe(sampleLevelId(0));
      expect(readDetail(group)).toBe(detail);
      for (const mesh of collectMeshes(group)) {
        expect(readPartData(mesh)?.entityId).toMatch(/^[WRD]-/);
      }
    }
  });

  it('writes nothing to the plan it was given', () => {
    const openingsBefore = STOREY.openings?.length;
    buildFloorAtDetail(STOREY, 'block');

    expect(STOREY.openings?.length).toBe(openingsBefore);
    expect(STOREY.walls).toHaveLength(WALL_COUNT);
  });
});

describe('buildFloorLod', () => {
  /** What three.js itself would draw at that distance. */
  function rungAt(lod: LOD, distanceM: number): DetailLevel | null {
    const chosen = lod.getObjectForDistance(distanceM);
    return chosen === null || chosen === undefined ? null : readDetail(chosen);
  }

  it('hands three.js the rung that matches the distance', () => {
    const lod = buildFloorLod(STOREY);

    expect(lod.name).toBe(sampleLevelId(0));
    expect(lod.levels).toHaveLength(3);
    expect(rungAt(lod, 0)).toBe('full');
    expect(rungAt(lod, 24.999)).toBe('full');
    expect(rungAt(lod, REDUCED_DISTANCE_M)).toBe('reduced');
    expect(rungAt(lod, 59.999)).toBe('reduced');
    expect(rungAt(lod, BLOCK_DISTANCE_M)).toBe('block');
  });

  it('agrees with detailLevelAt at every boundary', () => {
    const lod = buildFloorLod(STOREY);

    for (const distanceM of [0, 10, 24.999, 25, 40, 59.999, 60, 200]) {
      expect(rungAt(lod, distanceM)).toBe(detailLevelAt(distanceM));
    }
  });

  it('batches a rung down to a handful of draw calls', () => {
    const rung = buildFloorAtDetail(STOREY, 'reduced');
    const result = mergeByMaterial(paintByKind(collectMeshes(rung)));

    expect(result.batches.length).toBeLessThanOrEqual(6);
    expect(result.index.size).toBe(WALL_COUNT + ROOM_COUNT);
  });
});

/* -------------------------------------------------------------------------- */
/* Types the compiler has to keep honest.                                      */
/* -------------------------------------------------------------------------- */

describe('measurement units', () => {
  it('states the thresholds in scene units, which are metres', () => {
    const twentyFiveMetresInMm: Millimetres = millimetres(25000);
    expect(twentyFiveMetresInMm / 1000).toBe(REDUCED_DISTANCE_M);
  });
});
