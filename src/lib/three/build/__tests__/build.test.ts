import { Mesh, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { millimetres, type Millimetres } from '@/domain/units/types';
import type { PointMm } from '@/domain/units/compare';
import type { AttachedOpening, OpeningKind } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { OpeningId, WallId } from '@/domain/spatial/types';

import { readPartData, toSceneLength } from '../scene';
import { buildWallMesh, wallFrame, type WallPartData } from '../wall';
import {
  buildCeiling,
  buildFloorMesh,
  buildFloorSlab,
  OPENING_PANEL_THICKNESS_MM,
  SLAB_THICKNESS_MM,
  type BuildableLevel,
  type BuildableRoom,
} from '../floor';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const LEVEL: BuildableLevel = {
  id: 'L-01',
  elevationMm: millimetres(0),
  heightMm: millimetres(3000),
};

/** A 4 m wall, 200 mm thick, 3 m tall, running east along the x axis. */
const WALL_LENGTH_MM: Millimetres = millimetres(4000);
const WALL_THICKNESS_MM: Millimetres = millimetres(200);
const WALL_HEIGHT_MM: Millimetres = millimetres(3000);

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function makeWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: 'W-01',
    kind: 'partition',
    centreline: { start: pointAt(0, 0), end: pointAt(WALL_LENGTH_MM, 0) },
    thicknessMm: WALL_THICKNESS_MM,
    baseElevationMm: millimetres(0),
    topElevationMm: WALL_HEIGHT_MM,
    ...overrides,
  };
}

interface OpeningOverrides {
  readonly id?: OpeningId;
  readonly kind?: OpeningKind;
  readonly wallId?: WallId;
  readonly widthMm?: Millimetres;
  readonly heightMm?: Millimetres;
  readonly sillHeightMm?: Millimetres;
  readonly relativePosition?: number;
}

/** A 900 × 2100 door standing on the floor, centred on the wall. */
function makeDoor(overrides: OpeningOverrides = {}): AttachedOpening {
  return {
    id: overrides.id ?? 'D-1',
    kind: overrides.kind ?? 'door',
    widthMm: overrides.widthMm ?? millimetres(900),
    heightMm: overrides.heightMm ?? millimetres(2100),
    sillHeightMm: overrides.sillHeightMm ?? millimetres(0),
    swing: 'left',
    wallId: overrides.wallId ?? 'W-01',
    relativePosition: overrides.relativePosition ?? 0.5,
  };
}

/** A 1200 × 1400 window with a 900 mm sill, clear of the base and the top. */
function makeWindow(overrides: OpeningOverrides = {}): AttachedOpening {
  return {
    id: overrides.id ?? 'D-2',
    kind: overrides.kind ?? 'window',
    widthMm: overrides.widthMm ?? millimetres(1200),
    heightMm: overrides.heightMm ?? millimetres(1400),
    sillHeightMm: overrides.sillHeightMm ?? millimetres(900),
    swing: 'fixed',
    wallId: overrides.wallId ?? 'W-01',
    relativePosition: overrides.relativePosition ?? 0.5,
  };
}

/** A 5 × 4 m room, corners counter-clockwise, on the millimetre grid. */
const ROOM_WIDTH_MM: Millimetres = millimetres(5000);
const ROOM_DEPTH_MM: Millimetres = millimetres(4000);

const ROOM: BuildableRoom = {
  id: 'R-01',
  outline: [
    pointAt(0, 0),
    pointAt(ROOM_WIDTH_MM, 0),
    pointAt(ROOM_WIDTH_MM, ROOM_DEPTH_MM),
    pointAt(0, ROOM_DEPTH_MM),
  ],
};

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

/** Volume in cubic metres of a value given as three millimetre lengths. */
function boxVolume(first: Millimetres, second: Millimetres, third: Millimetres): number {
  return toSceneLength(first) * toSceneLength(second) * toSceneLength(third);
}

function triangleCount(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  return index === null ? geometry.getAttribute('position').count / 3 : index.count / 3;
}

/**
 * The volume a closed mesh encloses, by the divergence theorem.
 *
 * Each triangle contributes the signed volume of the tetrahedron it makes with
 * the origin; on a watertight surface the outside cancels and the inside is left.
 * This is what proves a hole is really a hole: a wall with a door has to come out
 * exactly one door short of a solid one, which no triangle count can show.
 */
function enclosedVolume(geometry: BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const readIndex = (at: number): number => (index === null ? at : index.getX(at));
  const count = index === null ? position.count : index.count;

  let total = 0;

  for (let corner = 0; corner + 2 < count; corner += 3) {
    const first = readIndex(corner);
    const second = readIndex(corner + 1);
    const third = readIndex(corner + 2);

    const ax = position.getX(first);
    const ay = position.getY(first);
    const az = position.getZ(first);
    const bx = position.getX(second);
    const by = position.getY(second);
    const bz = position.getZ(second);
    const cx = position.getX(third);
    const cy = position.getY(third);
    const cz = position.getZ(third);

    total += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }

  return Math.abs(total);
}

/** Every mesh in a subtree, in traversal order. */
function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) {
      found.push(object);
    }
  });
  return found;
}

function wallDataOf(mesh: Mesh): WallPartData {
  return mesh.userData as WallPartData;
}

/**
 * Tolerances, chosen for what a `BufferGeometry` can actually carry.
 *
 * Positions are `Float32Array`, so a coordinate a few metres from the origin is
 * exact to about a ten-millionth of a metre. Five decimals is ten micrometres —
 * four orders of magnitude below anything a drawing can express, and still well
 * inside what the buffer holds.
 *
 * Volumes are summed over every triangle of the mesh, so the same rounding
 * accumulates: a slab three metres up loses another decimal to cancellation
 * between tetrahedra. Four decimals is a tenth of a cubic decimetre, which is far
 * smaller than any opening this test cuts.
 */
const PLACES = 5;
const VOLUME_PLACES = 4;

/* -------------------------------------------------------------------------- */
/* Walls.                                                                      */
/* -------------------------------------------------------------------------- */

describe('buildWallMesh', () => {
  it('extrudes the centreline by thickness and height', () => {
    const mesh = buildWallMesh(makeWall(), { levelId: LEVEL.id });

    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(
      boxVolume(WALL_LENGTH_MM, WALL_HEIGHT_MM, WALL_THICKNESS_MM),
      VOLUME_PLACES,
    );
    expect(triangleCount(mesh.geometry)).toBe(12);
  });

  it('centres the wall body on the centreline, in metres', () => {
    const mesh = buildWallMesh(makeWall(), { levelId: LEVEL.id });
    const box = mesh.geometry.boundingBox;

    expect(box).not.toBeNull();
    expect(box?.min.x).toBeCloseTo(0, PLACES);
    expect(box?.max.x).toBeCloseTo(4, PLACES);
    expect(box?.min.y).toBeCloseTo(0, PLACES);
    expect(box?.max.y).toBeCloseTo(3, PLACES);
    // Half the 200 mm thickness each side of a centreline running along y = 0.
    expect(box?.min.z).toBeCloseTo(-0.1, PLACES);
    expect(box?.max.z).toBeCloseTo(0.1, PLACES);
  });

  it('follows a wall drawn in any direction', () => {
    const wall = makeWall({
      centreline: { start: pointAt(1000, 2000), end: pointAt(1000, 6000) },
    });
    const box = buildWallMesh(wall, { levelId: LEVEL.id }).geometry.boundingBox;

    expect(box?.min.x).toBeCloseTo(0.9, PLACES);
    expect(box?.max.x).toBeCloseTo(1.1, PLACES);
    expect(box?.min.z).toBeCloseTo(2, PLACES);
    expect(box?.max.z).toBeCloseTo(6, PLACES);
  });

  it('starts a wall at its own base elevation', () => {
    const wall = makeWall({
      baseElevationMm: millimetres(3300),
      topElevationMm: millimetres(6300),
    });
    const box = buildWallMesh(wall, { levelId: LEVEL.id }).geometry.boundingBox;

    expect(box?.min.y).toBeCloseTo(3.3, PLACES);
    expect(box?.max.y).toBeCloseTo(6.3, PLACES);
  });

  it('cuts a door out: more triangles than a solid wall, and exactly one opening', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const door = makeDoor();
    const withDoor = buildWallMesh(wall, { levelId: LEVEL.id, openings: [door] });

    expect(triangleCount(withDoor.geometry)).toBeGreaterThan(triangleCount(solid.geometry));
    expect(wallDataOf(withDoor).openingIds).toEqual(['D-1']);
    expect(wallDataOf(withDoor).refusals).toEqual([]);

    expect(enclosedVolume(withDoor.geometry)).toBeCloseTo(
      enclosedVolume(solid.geometry) - boxVolume(door.widthMm, door.heightMm, WALL_THICKNESS_MM),
      VOLUME_PLACES,
    );
  });

  it('cuts a window out as a hole clear of the base and the top', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const window = makeWindow();
    const withWindow = buildWallMesh(wall, { levelId: LEVEL.id, openings: [window] });

    expect(triangleCount(withWindow.geometry)).toBeGreaterThan(triangleCount(solid.geometry));
    expect(wallDataOf(withWindow).openingIds).toEqual(['D-2']);
    expect(enclosedVolume(withWindow.geometry)).toBeCloseTo(
      enclosedVolume(solid.geometry) -
        boxVolume(window.widthMm, window.heightMm, WALL_THICKNESS_MM),
      VOLUME_PLACES,
    );
  });

  it('cuts a door and a window out of the same wall', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const door = makeDoor({ relativePosition: 0.25 });
    const window = makeWindow({ relativePosition: 0.75 });
    const mesh = buildWallMesh(wall, { levelId: LEVEL.id, openings: [door, window] });

    expect(wallDataOf(mesh).openingIds).toEqual(['D-1', 'D-2']);
    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(
      enclosedVolume(solid.geometry) -
        boxVolume(door.widthMm, door.heightMm, WALL_THICKNESS_MM) -
        boxVolume(window.widthMm, window.heightMm, WALL_THICKNESS_MM),
      VOLUME_PLACES,
    );
  });

  it('splits the wall into two panels around a full-height opening', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const archway = makeDoor({ kind: 'void', heightMm: WALL_HEIGHT_MM });
    const mesh = buildWallMesh(wall, { levelId: LEVEL.id, openings: [archway] });

    expect(wallDataOf(mesh).openingIds).toEqual(['D-1']);
    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(
      enclosedVolume(solid.geometry) -
        boxVolume(archway.widthMm, WALL_HEIGHT_MM, WALL_THICKNESS_MM),
      VOLUME_PLACES,
    );
    // Two separate rectangular panels: twelve triangles each.
    expect(triangleCount(mesh.geometry)).toBe(24);
  });

  it('cuts a door that lands hard against the end of the wall', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const door = makeDoor({ relativePosition: 900 / 2 / WALL_LENGTH_MM });
    const mesh = buildWallMesh(wall, { levelId: LEVEL.id, openings: [door] });

    expect(wallDataOf(mesh).refusals).toEqual([]);
    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(
      enclosedVolume(solid.geometry) - boxVolume(door.widthMm, door.heightMm, WALL_THICKNESS_MM),
      VOLUME_PLACES,
    );
  });

  it('ignores openings that belong to another wall, and orphans', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const elsewhere = makeDoor({ id: 'D-9', wallId: 'W-02' });
    const orphan = {
      id: 'D-8' as OpeningId,
      kind: 'door' as OpeningKind,
      widthMm: millimetres(900),
      heightMm: millimetres(2100),
      sillHeightMm: millimetres(0),
      swing: 'left' as const,
      wallId: null,
      centre: pointAt(2000, 0),
      orphanReason: 'noWallInRange' as const,
    };
    const mesh = buildWallMesh(wall, { levelId: LEVEL.id, openings: [elsewhere, orphan] });

    expect(wallDataOf(mesh).openingIds).toEqual([]);
    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(enclosedVolume(solid.geometry), VOLUME_PLACES);
  });
});

describe('buildWallMesh refusals', () => {
  it('refuses a head above the top of the wall and builds the wall solid', () => {
    const wall = makeWall();
    const solid = buildWallMesh(wall, { levelId: LEVEL.id });
    const tooTall = makeWindow({ sillHeightMm: millimetres(2000), heightMm: millimetres(1400) });
    const mesh = buildWallMesh(wall, { levelId: LEVEL.id, openings: [tooTall] });

    expect(wallDataOf(mesh).openingIds).toEqual([]);
    expect(wallDataOf(mesh).refusals).toHaveLength(1);
    expect(wallDataOf(mesh).refusals[0]?.reason).toBe('aboveWallTop');
    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(enclosedVolume(solid.geometry), VOLUME_PLACES);
  });

  it('refuses an opening running past the end of the wall', () => {
    const mesh = buildWallMesh(makeWall(), {
      levelId: LEVEL.id,
      openings: [makeDoor({ relativePosition: 1 })],
    });

    expect(wallDataOf(mesh).refusals[0]?.reason).toBe('pastWallEnd');
  });

  it('refuses a size that is not a positive length', () => {
    const mesh = buildWallMesh(makeWall(), {
      levelId: LEVEL.id,
      openings: [makeDoor({ widthMm: millimetres(0) })],
    });

    expect(wallDataOf(mesh).refusals[0]?.reason).toBe('sizeNotPositive');
  });

  it('keeps the first of two openings in the same place and refuses the second', () => {
    const mesh = buildWallMesh(makeWall(), {
      levelId: LEVEL.id,
      openings: [makeDoor({ id: 'D-1' }), makeDoor({ id: 'D-2' })],
    });

    expect(wallDataOf(mesh).openingIds).toEqual(['D-1']);
    expect(wallDataOf(mesh).refusals[0]).toMatchObject({
      openingId: 'D-2',
      reason: 'overlapsAnother',
    });
  });

  it('explains a refusal in Vietnamese, naming the opening', () => {
    const mesh = buildWallMesh(makeWall(), {
      levelId: LEVEL.id,
      openings: [makeDoor({ relativePosition: 1 })],
    });

    expect(wallDataOf(mesh).refusals[0]?.message).toContain('Cửa đi D-1');
  });

  it('rejects a wall the geometry cannot work with', () => {
    expect(() => wallFrame(makeWall({ thicknessMm: millimetres(30) }))).toThrow(RangeError);
    expect(() =>
      buildWallMesh(makeWall({ topElevationMm: millimetres(0) }), { levelId: LEVEL.id }),
    ).toThrow(RangeError);
  });
});

/* -------------------------------------------------------------------------- */
/* Slabs and ceilings.                                                         */
/* -------------------------------------------------------------------------- */

describe('buildFloorSlab', () => {
  it('extrudes the room outline 150 mm thick', () => {
    const mesh = buildFloorSlab(ROOM, LEVEL);

    expect(SLAB_THICKNESS_MM).toBe(150);
    expect(enclosedVolume(mesh.geometry)).toBeCloseTo(
      boxVolume(ROOM_WIDTH_MM, ROOM_DEPTH_MM, SLAB_THICKNESS_MM),
      VOLUME_PLACES,
    );
  });

  it('hangs the slab under the finished floor, on the plan axes', () => {
    const box = buildFloorSlab(ROOM, LEVEL).geometry.boundingBox;

    expect(box?.max.y).toBeCloseTo(0, PLACES);
    expect(box?.min.y).toBeCloseTo(-0.15, PLACES);
    expect(box?.min.x).toBeCloseTo(0, PLACES);
    expect(box?.max.x).toBeCloseTo(5, PLACES);
    expect(box?.min.z).toBeCloseTo(0, PLACES);
    expect(box?.max.z).toBeCloseTo(4, PLACES);
  });

  it('rides up with the level it belongs to', () => {
    const upstairs: BuildableLevel = {
      id: 'L-02',
      elevationMm: millimetres(3300),
      heightMm: millimetres(3000),
    };
    const box = buildFloorSlab(ROOM, upstairs).geometry.boundingBox;

    expect(box?.max.y).toBeCloseTo(3.3, PLACES);
    expect(box?.min.y).toBeCloseTo(3.15, PLACES);
  });

  it('refuses an outline that encloses no floor', () => {
    expect(() => buildFloorSlab({ id: 'R-02', outline: [pointAt(0, 0)] }, LEVEL)).toThrow(RangeError);
    expect(() =>
      buildFloorSlab(
        { id: 'R-03', outline: [pointAt(0, 0), pointAt(1000, 0), pointAt(2000, 0)] },
        LEVEL,
      ),
    ).toThrow(RangeError);
    expect(() => buildFloorSlab(ROOM, LEVEL, millimetres(0))).toThrow(RangeError);
  });
});

describe('buildCeiling', () => {
  it('sits on the soffit, above the clear height of the room', () => {
    const box = buildCeiling(ROOM, LEVEL).geometry.boundingBox;

    expect(box?.min.y).toBeCloseTo(3, PLACES);
    expect(box?.max.y).toBeCloseTo(3.15, PLACES);
  });

  it('takes the same outline and thickness as the floor below it', () => {
    const floor = buildFloorSlab(ROOM, LEVEL);
    const ceiling = buildCeiling(ROOM, LEVEL);

    expect(enclosedVolume(ceiling.geometry)).toBeCloseTo(
      enclosedVolume(floor.geometry),
      VOLUME_PLACES,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* A whole storey.                                                             */
/* -------------------------------------------------------------------------- */

describe('buildFloorMesh', () => {
  const WALLS: readonly Wall[] = [
    makeWall({ id: 'W-01', centreline: { start: pointAt(0, 0), end: pointAt(5000, 0) } }),
    makeWall({ id: 'W-02', centreline: { start: pointAt(5000, 0), end: pointAt(5000, 4000) } }),
    makeWall({ id: 'W-03', centreline: { start: pointAt(5000, 4000), end: pointAt(0, 4000) } }),
    makeWall({ id: 'W-04', centreline: { start: pointAt(0, 4000), end: pointAt(0, 0) } }),
  ];

  const OPENINGS: readonly AttachedOpening[] = [
    makeDoor({ id: 'D-1', wallId: 'W-01', relativePosition: 0.5 }),
    makeWindow({ id: 'D-2', wallId: 'W-02', relativePosition: 0.5 }),
    makeDoor({ id: 'D-3', kind: 'void', wallId: 'W-03', relativePosition: 0.5 }),
  ];

  function buildStorey(): ReturnType<typeof buildFloorMesh> {
    return buildFloorMesh({ level: LEVEL, walls: WALLS, rooms: [ROOM], openings: OPENINGS });
  }

  it('names the group after the level', () => {
    const group = buildStorey();

    expect(group.name).toBe('L-01');
    expect(readPartData(group)).toMatchObject({ kind: 'level', entityId: 'L-01' });
  });

  it('gives every mesh a userData entity id pointing back at the model', () => {
    const meshes = meshesOf(buildStorey());

    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      const data = readPartData(mesh);
      expect(data).not.toBeNull();
      expect(data?.entityId).toMatch(/^[LWRD]-/);
      expect(data?.levelId).toBe('L-01');
    }
  });

  it('builds a wall per wall, a slab and a ceiling per room, and a panel per filled opening', () => {
    const byKind = new Map<string, string[]>();

    for (const mesh of meshesOf(buildStorey())) {
      const data = readPartData(mesh);
      if (data !== null) {
        byKind.set(data.kind, [...(byKind.get(data.kind) ?? []), data.entityId]);
      }
    }

    expect(byKind.get('wall')).toEqual(['W-01', 'W-02', 'W-03', 'W-04']);
    expect(byKind.get('floorSlab')).toEqual(['R-01']);
    expect(byKind.get('ceiling')).toEqual(['R-01']);
    // The archway D-3 is a `void`: a hole with nothing hung in it.
    expect(byKind.get('opening')).toEqual(['D-1', 'D-2']);
  });

  it('cuts each opening into the wall that owns it', () => {
    const walls = meshesOf(buildStorey()).filter((mesh) => readPartData(mesh)?.kind === 'wall');
    const cuts = walls.map((mesh) => wallDataOf(mesh).openingIds);

    expect(cuts).toEqual([['D-1'], ['D-2'], ['D-3'], []]);
  });

  it('hangs the door panel inside the hole it fills', () => {
    const panel = meshesOf(buildStorey()).find((mesh) => readPartData(mesh)?.entityId === 'D-1');
    const box = panel?.geometry.boundingBox;

    expect(enclosedVolume(panel?.geometry as BufferGeometry)).toBeCloseTo(
      boxVolume(millimetres(900), millimetres(2100), OPENING_PANEL_THICKNESS_MM),
      VOLUME_PLACES,
    );
    // Centred on the 5 m wall, standing on the floor, 2,1 m to the head.
    expect(box?.min.x).toBeCloseTo(2.05, PLACES);
    expect(box?.max.x).toBeCloseTo(2.95, PLACES);
    expect(box?.min.y).toBeCloseTo(0, PLACES);
    expect(box?.max.y).toBeCloseTo(2.1, PLACES);
    expect(box?.min.z).toBeCloseTo(-0.02, PLACES);
    expect(box?.max.z).toBeCloseTo(0.02, PLACES);
  });

  it('adds nothing at all when the storey is empty', () => {
    const group = buildFloorMesh({ level: LEVEL, walls: [], rooms: [] });

    expect(group.name).toBe('L-01');
    expect(meshesOf(group)).toEqual([]);
  });

  it('repeats itself exactly, so a snapshot of the scene is worth taking', () => {
    const first = meshesOf(buildStorey()).map((mesh) => mesh.name);
    const second = meshesOf(buildStorey()).map((mesh) => mesh.name);

    expect(second).toEqual(first);
  });
});

/* -------------------------------------------------------------------------- */
/* The unit boundary.                                                          */
/* -------------------------------------------------------------------------- */

describe('scene units', () => {
  it('converts millimetres to metres once, at the boundary', () => {
    expect(toSceneLength(millimetres(4000))).toBe(4);
    expect(toSceneLength(millimetres(150))).toBe(0.15);
  });

  it('places a wall frame at the start of the centreline, in metres', () => {
    const position = wallFrame(makeWall({ centreline: { start: pointAt(1500, 2500), end: pointAt(1500, 6000) } }));

    expect(position.elements[12]).toBeCloseTo(1.5, PLACES);
    expect(position.elements[13]).toBeCloseTo(0, PLACES);
    expect(position.elements[14]).toBeCloseTo(2.5, PLACES);
  });

  it('reads nothing back off an object that is not one of ours', () => {
    expect(readPartData(new Mesh())).toBeNull();
  });
});
