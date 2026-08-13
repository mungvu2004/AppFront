/**
 * Duplicating a typical floor onto another level.
 *
 * Most of a building is the same floor over and over. Tracing the third,
 * fourth and fifth storeys of a tower by hand produces three slightly different
 * drawings of one storey, which is exactly the drift the axis grid then has to
 * repair. Copying the floor instead gives every level the same geometry by
 * construction, and the levels stack because they were never allowed to differ.
 *
 * A copy is a new floor, not a second view of the old one, so two rules hold
 * without exception:
 *
 * - **Every copied object gets a new id.** Reusing an id would make one wall
 *   exist on two levels, and the first edit to either would silently change
 *   both. Every id the source floor uses is reserved before minting starts, so
 *   no minted id can collide with one — including when the caller injects its
 *   own id factory, which is checked rather than trusted.
 * - **References are rewritten, never carried over.** A copied room points at
 *   copied walls, a copied opening at the copied wall it is cut into. A
 *   reference that cannot be rewritten is dropped and reported instead of being
 *   left dangling at the floor below.
 *
 * Nothing is copied as reviewed. The geometry may have been approved downstairs
 * but nobody has looked at it up here, and the verified green belongs to a
 * person who has. `source` is carried over unchanged, because where the
 * geometry originally came from has not changed.
 *
 * The function is pure. `createId` in the real graph draws on a counter and on
 * `Math.random`, so it is taken as an argument rather than called: given the
 * same floor, the same target and the same options, `copyFloor` returns the
 * same result. Called without a factory it mints ids by hashing the target
 * level and the source id, which is deterministic and collision-checked.
 */

import { ID_PREFIX_BY_KIND, isIdOfKind, type EntityKind, type IdByKind } from '../spatial/ids';
import type {
  Axis,
  BoundingBox,
  Dimension,
  EntityId,
  Furniture,
  LevelId,
  Opening,
  OpeningId,
  Point,
  Room,
  RoomId,
  Segment,
  Wall,
  WallId,
} from '../spatial/types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** Everything that sits on one level. */
export interface FloorContents {
  readonly levelId: LevelId;
  readonly walls: readonly Wall[];
  readonly openings: readonly Opening[];
  readonly rooms: readonly Room[];
  readonly furniture: readonly Furniture[];
  readonly axes: readonly Axis[];
  readonly dimensions: readonly Dimension[];
}

/**
 * Mints an id for a copied object.
 *
 * Given the kind the id must belong to and the id being copied. Injected so
 * that the graph's own generator — which is not pure — can be used in the
 * application while tests stay deterministic. What comes back is checked
 * against the kind before it is used, so a factory that returns the wrong
 * prefix is caught rather than believed.
 */
export type IdFactory = (kind: EntityKind, sourceId: EntityId) => EntityId;

/**
 * What to bring along.
 *
 * Walls always come: a floor without them is not a copy of the floor. The rest
 * default to being copied, so switching a part off is a deliberate act.
 */
export interface CopyFloorOptions {
  readonly createId?: IdFactory;
  /** Ids in use elsewhere in the graph; a minted id may never be one of them. */
  readonly reservedIds?: Iterable<string>;
  readonly includeOpenings?: boolean;
  readonly includeRooms?: boolean;
  readonly includeFurniture?: boolean;
  readonly includeAxes?: boolean;
  readonly includeDimensions?: boolean;
}

/** The new floor, and what it cost to make. */
export interface CopyFloorResult {
  readonly contents: FloorContents;
  /** Source id to copied id, for every object that made it across. */
  readonly idMap: ReadonlyMap<EntityId, EntityId>;
  /**
   * Source objects left behind: parts switched off, and objects whose
   * references could not be rewritten.
   */
  readonly droppedSourceIds: readonly EntityId[];
  /** How many objects the new floor holds. */
  readonly copiedCount: number;
}

/* -------------------------------------------------------------------------- */
/* Minting ids.                                                                */
/* -------------------------------------------------------------------------- */

const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Shortest id body the graph accepts. */
const ID_BODY_LENGTH = 10;

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

/**
 * FNV-1a over the target level and the source id.
 *
 * A hash rather than a counter, so the same wall copied onto the same level
 * always lands on the same id however many times the copy is recomputed, and
 * two different walls do not queue up behind one number.
 */
function hashOf(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function encodeBody(value: number): string {
  let remaining = value;
  let encoded = '';
  do {
    encoded = ID_ALPHABET.charAt(remaining % ID_ALPHABET.length) + encoded;
    remaining = Math.floor(remaining / ID_ALPHABET.length);
  } while (remaining > 0);
  return encoded.padStart(ID_BODY_LENGTH, '0');
}

/** Every id the source floor already uses, plus whatever the caller reserved. */
function collectReserved(source: FloorContents, reserved: Iterable<string> | undefined): Set<string> {
  const taken = new Set<string>(reserved ?? []);
  taken.add(source.levelId);
  for (const wall of source.walls) {
    taken.add(wall.id);
  }
  for (const opening of source.openings) {
    taken.add(opening.id);
  }
  for (const room of source.rooms) {
    taken.add(room.id);
  }
  for (const item of source.furniture) {
    taken.add(item.id);
  }
  for (const axis of source.axes) {
    taken.add(axis.id);
  }
  for (const dimension of source.dimensions) {
    taken.add(dimension.id);
  }
  return taken;
}

/** Deterministic minting, used when the caller injects no factory. */
function hashedIdFactory(targetLevelId: LevelId, taken: ReadonlySet<string>): IdFactory {
  return (kind: EntityKind, sourceId: EntityId): EntityId => {
    let value = hashOf(`${targetLevelId}:${sourceId}`);
    let candidate = `${ID_PREFIX_BY_KIND[kind]}-${encodeBody(value)}`;
    while (taken.has(candidate)) {
      value = (value + 1) >>> 0;
      candidate = `${ID_PREFIX_BY_KIND[kind]}-${encodeBody(value)}`;
    }
    return candidate as EntityId;
  };
}

/* -------------------------------------------------------------------------- */
/* Copying geometry.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Geometry is cloned, never shared.
 *
 * `Point`, `Segment` and `BoundingBox` are mutable, so handing the copy the
 * same object would let an edit on one floor move a wall on another.
 */
function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function cloneSegment(segment: Segment): Segment {
  return { start: clonePoint(segment.start), end: clonePoint(segment.end) };
}

function cloneBoundingBox(box: BoundingBox): BoundingBox {
  return { min: clonePoint(box.min), max: clonePoint(box.max) };
}

/* -------------------------------------------------------------------------- */
/* Copying one floor.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Duplicate a floor onto another level.
 *
 * The objects are copied in a fixed order — walls, openings, rooms, furniture,
 * axes, dimensions — so ids are minted in the same order every time. References
 * are rewritten afterwards against the finished map, which is what lets a room
 * point at walls and a wall point back at its openings without either needing
 * to be copied first.
 *
 * Axis labels come across untouched: `B-3` upstairs being the same `B-3` as
 * downstairs is the whole point of a setting-out grid.
 *
 * @throws RangeError when the target level is the source level — a floor copied
 * onto itself would double every wall on it.
 * @throws Error when an injected `createId` returns an id already in use, or an
 * id of the wrong kind. Either would corrupt the graph, and neither can be
 * repaired here.
 */
export function copyFloor(
  source: FloorContents,
  targetLevelId: LevelId,
  options: CopyFloorOptions = {},
): CopyFloorResult {
  if (targetLevelId === source.levelId) {
    throw new RangeError(`Cannot copy level ${source.levelId} onto itself.`);
  }

  const includeOpenings = options.includeOpenings ?? true;
  const includeRooms = options.includeRooms ?? true;
  const includeFurniture = options.includeFurniture ?? true;
  const includeAxes = options.includeAxes ?? true;
  const includeDimensions = options.includeDimensions ?? true;

  const taken = collectReserved(source, options.reservedIds);
  const factory = options.createId ?? hashedIdFactory(targetLevelId, taken);
  const idMap = new Map<EntityId, EntityId>();
  const droppedSourceIds: EntityId[] = [];

  const mint = <K extends EntityKind>(kind: K, sourceId: EntityId): IdByKind[K] => {
    const created = factory(kind, sourceId);
    if (!isIdOfKind(kind, created)) {
      throw new Error(`copyFloor: minted id ${created} for ${sourceId} is not a valid ${kind} id.`);
    }
    if (taken.has(created)) {
      throw new Error(`copyFloor: minted id ${created} for ${sourceId} is already in use.`);
    }
    taken.add(created);
    idMap.set(sourceId, created);
    return created;
  };

  /** The copied id of a source object, or `null` when it did not come across. */
  const remap = <T extends EntityId>(id: T): T | null => {
    const next = idMap.get(id);
    return next === undefined ? null : (next as T);
  };

  /* Ids first, in a fixed order, so the map is complete before it is read. --- */

  const wallIds = source.walls.map((wall) => mint('wall', wall.id));
  const openingIds = includeOpenings
    ? source.openings.map((opening) => mint('opening', opening.id))
    : [];
  const roomIds = includeRooms ? source.rooms.map((room) => mint('room', room.id)) : [];
  const furnitureIds = includeFurniture
    ? source.furniture.map((item) => mint('furniture', item.id))
    : [];
  const axisIds = includeAxes ? source.axes.map((axis) => mint('axis', axis.id)) : [];
  const dimensionIds = includeDimensions
    ? source.dimensions.map((dimension) => mint('dimension', dimension.id))
    : [];

  if (!includeOpenings) {
    droppedSourceIds.push(...source.openings.map((opening) => opening.id));
  }
  if (!includeRooms) {
    droppedSourceIds.push(...source.rooms.map((room) => room.id));
  }
  if (!includeFurniture) {
    droppedSourceIds.push(...source.furniture.map((item) => item.id));
  }
  if (!includeAxes) {
    droppedSourceIds.push(...source.axes.map((axis) => axis.id));
  }
  if (!includeDimensions) {
    droppedSourceIds.push(...source.dimensions.map((dimension) => dimension.id));
  }

  /* Then the objects, with every reference rewritten. ---------------------- */

  const openings: Opening[] = [];
  source.openings.forEach((opening, index) => {
    const id = openingIds[index];
    if (id === undefined) {
      return;
    }
    const wallId = remap(opening.wallId);
    if (wallId === null) {
      // The wall it is cut into is on another floor; the copy would hang off
      // the level below.
      droppedSourceIds.push(opening.id);
      idMap.delete(opening.id);
      return;
    }
    openings.push({
      id,
      wallId,
      kind: opening.kind,
      offsetMm: opening.offsetMm,
      widthMm: opening.widthMm,
      heightMm: opening.heightMm,
      sillHeightMm: opening.sillHeightMm,
      swing: opening.swing,
      confidence: opening.confidence,
      source: opening.source,
      reviewed: false,
    });
  });

  const walls: Wall[] = [];
  source.walls.forEach((wall, index) => {
    const id = wallIds[index];
    if (id === undefined) {
      return;
    }
    walls.push({
      id,
      levelId: targetLevelId,
      centreline: cloneSegment(wall.centreline),
      thicknessMm: wall.thicknessMm,
      heightMm: wall.heightMm,
      kind: wall.kind,
      openingIds: wall.openingIds
        .map((openingId) => remap(openingId))
        .filter((openingId): openingId is OpeningId => openingId !== null),
      confidence: wall.confidence,
      source: wall.source,
      reviewed: false,
    });
  });

  const rooms: Room[] = [];
  source.rooms.forEach((room, index) => {
    const id = roomIds[index];
    if (id === undefined) {
      return;
    }
    rooms.push({
      id,
      levelId: targetLevelId,
      name: room.name,
      usage: room.usage,
      outline: room.outline.map(clonePoint),
      areaM2: room.areaM2,
      wallIds: room.wallIds
        .map((wallId) => remap(wallId))
        .filter((wallId): wallId is WallId => wallId !== null),
      confidence: room.confidence,
      source: room.source,
      reviewed: false,
    });
  });

  const furniture: Furniture[] = [];
  source.furniture.forEach((item, index) => {
    const id = furnitureIds[index];
    if (id === undefined) {
      return;
    }
    const copied: Furniture = {
      id,
      levelId: targetLevelId,
      kind: item.kind,
      centre: clonePoint(item.centre),
      boundingBox: cloneBoundingBox(item.boundingBox),
      rotationDeg: item.rotationDeg,
      confidence: item.confidence,
      source: item.source,
      reviewed: false,
    };
    const roomId: RoomId | null = item.roomId === undefined ? null : remap(item.roomId);
    furniture.push(roomId === null ? copied : { ...copied, roomId });
  });

  const axes: Axis[] = [];
  source.axes.forEach((axis, index) => {
    const id = axisIds[index];
    if (id === undefined) {
      return;
    }
    axes.push({
      id,
      levelId: targetLevelId,
      label: axis.label,
      direction: axis.direction,
      line: cloneSegment(axis.line),
      confidence: axis.confidence,
      source: axis.source,
      reviewed: false,
    });
  });

  const dimensions: Dimension[] = [];
  source.dimensions.forEach((dimension, index) => {
    const id = dimensionIds[index];
    if (id === undefined) {
      return;
    }
    const referenceIds = dimension.referenceIds.map((referenceId) => remap(referenceId));
    if (referenceIds.some((referenceId) => referenceId === null)) {
      // A dimension that has lost one of its ends measures nothing.
      droppedSourceIds.push(dimension.id);
      idMap.delete(dimension.id);
      return;
    }
    const copied: Dimension = {
      id,
      levelId: targetLevelId,
      kind: dimension.kind,
      referenceIds: referenceIds.filter((referenceId): referenceId is EntityId => referenceId !== null),
      line: cloneSegment(dimension.line),
      valueMm: dimension.valueMm,
      confidence: dimension.confidence,
      source: dimension.source,
      reviewed: false,
    };
    dimensions.push(
      dimension.overrideValueMm === undefined
        ? copied
        : { ...copied, overrideValueMm: dimension.overrideValueMm },
    );
  });

  return {
    contents: { levelId: targetLevelId, walls, openings, rooms, furniture, axes, dimensions },
    idMap,
    droppedSourceIds,
    copiedCount:
      walls.length +
      openings.length +
      rooms.length +
      furniture.length +
      axes.length +
      dimensions.length,
  };
}

/** Every id the floor uses, in copy order. Handy for checking a copy. */
export function floorEntityIds(contents: FloorContents): EntityId[] {
  return [
    ...contents.walls.map((wall) => wall.id),
    ...contents.openings.map((opening) => opening.id),
    ...contents.rooms.map((room) => room.id),
    ...contents.furniture.map((item) => item.id),
    ...contents.axes.map((axis) => axis.id),
    ...contents.dimensions.map((dimension) => dimension.id),
  ];
}
