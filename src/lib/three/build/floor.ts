/**
 * Floors, ceilings, and a whole storey gathered into one group.
 *
 * A room is stored as an outline and nothing else: no slab, no soffit, no
 * thickness. That is right for a plan — a floor has no shape of its own, it has
 * the shape of the room above it — and it means the third dimension has to be
 * **generated**, the same way `wall.ts` generates a wall from a centreline.
 *
 * The method is the same too, and for the same reason: a room outline becomes a
 * `THREE.Shape` and is extruded 150 mm. No model is loaded and no boolean solver
 * is involved, so a room with a re-entrant corner or a bay window costs exactly
 * what a rectangle costs.
 *
 * Where the slab sits is a decision, not an accident, and it is this one:
 *
 * - `elevationMm` on a level is the **finished floor**, the line a person stands
 *   on and the line a dimension is taken from. The floor slab therefore hangs
 *   *below* it: its top face is the finished floor and its 150 mm go downwards.
 * - The ceiling soffit is `elevationMm + heightMm`, so the clear height of the
 *   room is the height the level declares. The ceiling slab sits *above* the
 *   soffit, and the storey above it starts where its own slab says it does.
 *
 * Put the slab the other way round and every room is 150 mm too tall, which is
 * not visible on screen and is very visible in a schedule.
 *
 * `buildFloorMesh` puts the whole storey together. It is the function a viewer
 * calls: walls with their openings cut, a slab and a ceiling per room, and a
 * panel hung in every door and window so a person can click the door rather than
 * the hole where the door is. The group is named after the level, and every mesh
 * inside it carries the model id it came from.
 */

import { BoxGeometry, ExtrudeGeometry, Group, Mesh, Shape } from 'three';

import { compareNearly, isNearlyZero, type PointMm } from '@/domain/units/compare';
import { millimetres, type Millimetres } from '@/domain/units/types';
import { signedAreaMm2 } from '@/domain/rooms/area';
import { openingSpan } from '@/domain/openings/validate';
import { isAttached, type AttachedOpening, type Opening } from '@/domain/openings/types';
import type { Wall } from '@/domain/walls/types';
import type { LevelId, OpeningId, RoomId } from '@/domain/spatial/types';

import { sceneVector2, tagPart, toSceneLength, type PartUserData } from './scene';
import { buildWallMesh, wallFrame, type WallPartData } from './wall';

/* -------------------------------------------------------------------------- */
/* Constants.                                                                  */
/* -------------------------------------------------------------------------- */

/** How thick a generated slab is, floor and ceiling alike. */
export const SLAB_THICKNESS_MM: Millimetres = millimetres(150);

/**
 * How thick the panel hung in an opening is.
 *
 * A door leaf and a sealed unit are not the same thickness in life, but the panel
 * is a handle to click and a surface to shade, not a joinery drawing, and one
 * number keeps it from pretending to be more than that. Forty millimetres always
 * fits: the thinnest wall the model accepts is 60 mm.
 */
export const OPENING_PANEL_THICKNESS_MM: Millimetres = millimetres(40);

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** The least a room has to be for a slab to be generated from it. */
export interface BuildableRoom {
  readonly id: RoomId;
  /** Closed outline, first vertex not repeated at the end. */
  readonly outline: readonly PointMm[];
}

/**
 * The least a storey has to be to be built.
 *
 * `elevationMm` is the finished floor above the project datum and `heightMm` is
 * the clear height from it to the ceiling soffit — the same two numbers the
 * spatial graph's `Level` carries, so a caller passes the level it already has.
 */
export interface BuildableLevel {
  readonly id: LevelId;
  readonly elevationMm: Millimetres;
  readonly heightMm: Millimetres;
}

/** What a slab or a ceiling points back at. */
export interface SlabPartData extends PartUserData {
  readonly kind: 'floorSlab' | 'ceiling';
  readonly entityId: RoomId;
  readonly thicknessMm: Millimetres;
}

/** What a door leaf or a pane of glazing points back at. */
export interface OpeningPartData extends PartUserData {
  readonly kind: 'opening';
  readonly entityId: OpeningId;
  /** The wall the panel is hung in. */
  readonly wallId: Wall['id'];
}

/** Everything one storey is built from. */
export interface BuildFloorInput {
  readonly level: BuildableLevel;
  /** Walls on this storey. Nothing checks that they are; the caller decides. */
  readonly walls: readonly Wall[];
  readonly rooms: readonly BuildableRoom[];
  /** Openings anywhere on the plan; only the ones on these walls are used. */
  readonly openings?: readonly Opening[];
  /** Slab thickness, floor and ceiling alike. */
  readonly slabThicknessMm?: Millimetres;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** Fewer corners than this and an outline encloses no floor to build. */
const MIN_OUTLINE_VERTICES = 3;

/** No length at all, as a labelled quantity. */
const ZERO_MM: Millimetres = millimetres(0);

/**
 * Reject an outline or a thickness a slab cannot be made from.
 *
 * Nothing is repaired, in keeping with the rest of the model: a room outline that
 * encloses no area is a detection that went wrong, and quietly returning an empty
 * mesh would hide it behind a floor that merely looks missing.
 *
 * @throws RangeError when the outline has fewer than three corners, encloses no
 * area, or the thickness is not a positive length.
 */
function assertBuildableSlab(room: BuildableRoom, thicknessMm: Millimetres): void {
  if (room.outline.length < MIN_OUTLINE_VERTICES) {
    throw new RangeError(
      `Room ${room.id} has ${String(room.outline.length)} corners; a slab needs at least ` +
        `${String(MIN_OUTLINE_VERTICES)}.`,
    );
  }
  if (isNearlyZero(signedAreaMm2(room.outline))) {
    throw new RangeError(`Room ${room.id} encloses no area, so it has no slab to build.`);
  }
  if (compareNearly(thicknessMm, ZERO_MM) <= 0) {
    throw new RangeError(`Slab thickness must be a positive length: ${String(thicknessMm)}`);
  }
}

/**
 * A room outline extruded into a slab, with its **top** face at the elevation given.
 *
 * The shape is drawn on the plan axes and then laid down: `rotateX` turns the
 * extrusion axis into the vertical, which leaves the slab hanging under `y = 0`,
 * and the translation lifts its top face to where it belongs. Both callers state
 * the top face because that is the face a drawing dimensions.
 */
function slabMesh(
  room: BuildableRoom,
  level: BuildableLevel,
  thicknessMm: Millimetres,
  topElevationMm: Millimetres,
  kind: SlabPartData['kind'],
): Mesh {
  assertBuildableSlab(room, thicknessMm);

  const geometry = new ExtrudeGeometry(
    new Shape(room.outline.map((corner) => sceneVector2(corner.x, corner.y))),
    { depth: toSceneLength(thicknessMm), bevelEnabled: false, steps: 1 },
  );

  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, toSceneLength(topElevationMm), 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const data: SlabPartData = {
    kind,
    entityId: room.id,
    levelId: level.id,
    thicknessMm,
  };

  return tagPart(new Mesh(geometry), data);
}

/** The openings that were really cut into a wall, in the order they were cut. */
function cutOpenings(
  mesh: Mesh,
  openings: readonly Opening[],
): readonly AttachedOpening[] {
  const data = mesh.userData as WallPartData;
  const byId = new Map<OpeningId, AttachedOpening>();

  for (const opening of openings) {
    if (isAttached(opening)) {
      byId.set(opening.id, opening);
    }
  }

  return data.openingIds
    .map((openingId) => byId.get(openingId))
    .filter((opening): opening is AttachedOpening => opening !== undefined);
}

/**
 * A panel filling one opening: a door leaf, or the glazing of a window.
 *
 * Built in the wall's own frame — along, up, across — and then carried into the
 * scene by the same matrix the wall body used, so the panel lands in the hole
 * whatever direction the wall runs in. A `void` has nothing hung in it and never
 * reaches this function.
 */
function openingPanelMesh(wall: Wall, opening: AttachedOpening, levelId: LevelId): Mesh {
  const span = openingSpan(wall, opening);

  const geometry = new BoxGeometry(
    toSceneLength(opening.widthMm),
    toSceneLength(opening.heightMm),
    toSceneLength(OPENING_PANEL_THICKNESS_MM),
  );

  geometry.translate(
    toSceneLength(span.centreMm),
    toSceneLength(millimetres(opening.sillHeightMm + opening.heightMm / 2)),
    0,
  );
  geometry.applyMatrix4(wallFrame(wall));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const data: OpeningPartData = {
    kind: 'opening',
    entityId: opening.id,
    levelId,
    wallId: wall.id,
  };

  return tagPart(new Mesh(geometry), data);
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The floor slab under a room: 150 mm, its top face at the finished floor.
 *
 * No material is assigned; colour is a token decision and belongs to the caller.
 *
 * @throws RangeError when the outline has fewer than three corners, encloses no
 * area, or the thickness is not a positive length.
 */
export function buildFloorSlab(
  room: BuildableRoom,
  level: BuildableLevel,
  thicknessMm: Millimetres = SLAB_THICKNESS_MM,
): Mesh {
  return slabMesh(room, level, thicknessMm, level.elevationMm, 'floorSlab');
}

/**
 * The ceiling over a room: 150 mm sitting **on** the soffit.
 *
 * The soffit is `elevationMm + heightMm`, so the room keeps the clear height its
 * level declares and the slab thickness is added above it rather than taken out
 * of it.
 *
 * @throws RangeError when the outline has fewer than three corners, encloses no
 * area, or the thickness is not a positive length.
 */
export function buildCeiling(
  room: BuildableRoom,
  level: BuildableLevel,
  thicknessMm: Millimetres = SLAB_THICKNESS_MM,
): Mesh {
  const soffitMm = millimetres(level.elevationMm + level.heightMm);
  return slabMesh(room, level, thicknessMm, millimetres(soffitMm + thicknessMm), 'ceiling');
}

/**
 * A whole storey as one group, named after the level.
 *
 * The children are added in a fixed order — every wall, then every floor slab,
 * then every ceiling, then every opening panel — so two runs on the same plan
 * produce the same scene graph and a visual snapshot is worth taking.
 *
 * A room contributes two meshes, its slab and its ceiling, and both carry the
 * room id; `userData.kind` is what tells them apart. An opening of kind `void`
 * contributes none: an archway is a hole, and there is nothing to hang in it.
 *
 * Openings attached to walls that are not in `walls`, and openings the wall
 * refused to cut, get no panel either — a pane of glass with no hole behind it
 * would be the one thing on screen that is not in the model. The wall mesh's
 * `userData.refusals` says why each of those was refused.
 */
export function buildFloorMesh(input: BuildFloorInput): Group {
  const { level, walls, rooms } = input;
  const openings = input.openings ?? [];
  const thicknessMm = input.slabThicknessMm ?? SLAB_THICKNESS_MM;

  const group = new Group();
  const panels: Mesh[] = [];

  for (const wall of walls) {
    const mesh = buildWallMesh(wall, { levelId: level.id, openings });
    group.add(mesh);

    for (const opening of cutOpenings(mesh, openings)) {
      if (opening.kind !== 'void') {
        panels.push(openingPanelMesh(wall, opening, level.id));
      }
    }
  }

  for (const room of rooms) {
    group.add(buildFloorSlab(room, level, thicknessMm));
  }
  for (const room of rooms) {
    group.add(buildCeiling(room, level, thicknessMm));
  }
  for (const panel of panels) {
    group.add(panel);
  }

  return tagPart(group, { kind: 'level', entityId: level.id, levelId: level.id });
}
