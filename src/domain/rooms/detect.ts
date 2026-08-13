/**
 * Finding rooms, which nobody drew.
 *
 * A room is not an object on a floor plan. It is what is left over once the
 * walls are in place: a closed cycle in the wall graph with nothing but floor
 * inside it. So it cannot be read off the input — it has to be found, and found
 * the same way every time, because a room that appears on one run and not the
 * next is worse than no room at all.
 *
 * The search is the left-turn walk. Take any wall, walk along it, and at the far
 * end always take the sharpest turn to the left that is available. Keep going
 * and you come back where you started, having traced one face of the graph.
 * Repeat from every wall, in both directions, and every face has been traced
 * exactly once, because each direction of each wall belongs to exactly one face.
 *
 * Turning left keeps the enclosed area on the left, which makes each face come
 * out counter-clockwise — except one. The face outside the building is traced
 * the other way round and so has a negative area, which is how it is recognised
 * and dropped. Exactly one face per connected piece of the drawing behaves that
 * way, so the test is exact rather than a heuristic about size or position.
 *
 * Two things separate a found face from a room a surveyor would sign:
 *
 * - **Rooms are measured to the clear face.** The walk runs along centrelines,
 *   because that is where the graph lives, but a room is the space you can
 *   stand in. Every boundary is pulled inwards by half the thickness of the wall
 *   that drew it, and the corners are re-cut where those pulled-back lines meet.
 *   A room bounded by 220 mm walls is 220 mm narrower than its centrelines, in
 *   both directions.
 * - **Small faces are doubted, not deleted.** Below a square metre a face is
 *   almost always a sliver between two walls that nearly line up rather than a
 *   cupboard — but "almost always" is not "always", so it is marked `suspect`
 *   and kept. Deleting it would take the decision away from the one person who
 *   can actually make it.
 *
 * Every function is pure: no input is written to, and the same walls always
 * produce the same rooms, in the same order, with the same vertices.
 */

import { compareNearly, isNearlyZero, nearlyEqualPoint, type PointMm } from '../units/compare';
import {
  millimetres,
  squareMetres,
  SQUARE_MILLIMETRES_PER_SQUARE_METRE,
  type Millimetres,
  type SquareMetres,
} from '../units/types';
import type { WallId } from '../spatial/types';
import type { Wall } from '../walls/types';
import {
  buildWallGraph,
  DEFAULT_WELD_GAP_MM,
  type GraphEdge,
  type PlanarWallGraph,
} from './graph';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How much a found room is to be trusted.
 *
 * `suspect` is not a failure: it says the shape closed but is too small to be a
 * room on its own reading, and a person should look. Nothing is discarded.
 */
export type RoomTrust = 'trusted' | 'suspect';

/** Below this clear area a face is doubted rather than believed. */
export const MIN_TRUSTED_ROOM_AREA_M2: SquareMetres = squareMetres(1);

/** One closed face of the wall graph, measured as a room. */
export interface DetectedRoom {
  /** Clear outline counter-clockwise, first vertex not repeated at the end. */
  readonly outline: readonly PointMm[];
  /** The same face along the wall centrelines, for drawing and debugging. */
  readonly centrelineOutline: readonly PointMm[];
  /** Clear area, from the outline above. */
  readonly areaM2: SquareMetres;
  /** Walls that bound this room, sorted, each listed once. */
  readonly wallIds: readonly WallId[];
  readonly trust: RoomTrust;
}

/** What `detectRooms` found, and what it had to do to the drawing to find it. */
export interface DetectRoomsResult {
  readonly rooms: readonly DetectedRoom[];
  /** The graph the walk ran on, so a caller can show what was welded or pruned. */
  readonly graph: PlanarWallGraph;
}

export interface DetectRoomsOptions {
  /** Widest hole in the drawing that is still welded shut. */
  readonly weldGapMm?: Millimetres;
  /** Clear area below which a face is marked `suspect`. */
  readonly minTrustedAreaM2?: SquareMetres;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One direction of travel along one edge.
 *
 * Every edge has two, numbered `2 * edgeId` and `2 * edgeId + 1`, so the
 * opposite direction is one exclusive-or away and needs no lookup.
 */
type DartId = number;

/** A straight line carrying the wall face a room is measured to. */
interface OffsetLine {
  readonly origin: PointMm;
  readonly directionX: number;
  readonly directionY: number;
}

function itemAt<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(
      `Index ${String(index)} falls outside a list of ${String(items.length)} items.`,
    );
  }
  return item;
}

/** Read a list cyclically, so `-1` is the last item and `length` the first. */
function cyclicAt<TItem>(items: readonly TItem[], index: number): TItem {
  const count = items.length;
  return itemAt(items, ((index % count) + count) % count);
}

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function twinOf(dart: DartId): DartId {
  return dart ^ 1;
}

function edgeOf(graph: PlanarWallGraph, dart: DartId): GraphEdge {
  return itemAt(graph.edges, dart >> 1);
}

function tailOf(graph: PlanarWallGraph, dart: DartId): number {
  const edge = edgeOf(graph, dart);
  return (dart & 1) === 0 ? edge.fromVertexId : edge.toVertexId;
}

function headOf(graph: PlanarWallGraph, dart: DartId): number {
  return tailOf(graph, twinOf(dart));
}

function positionOf(graph: PlanarWallGraph, vertexId: number): PointMm {
  return itemAt(graph.vertices, vertexId).position;
}

/**
 * The darts leaving each vertex, counter-clockwise, and where each one sits.
 *
 * The slot table is what makes the left turn a constant-time step: from an
 * arriving dart the walk needs the position of its opposite in the ring around
 * the vertex it arrived at, and looking that up by search would turn the walk
 * quadratic on a plan with long wall runs.
 */
interface DartRings {
  /** `rings[vertexId]` lists the darts leaving that vertex, counter-clockwise. */
  readonly rings: readonly (readonly DartId[])[];
  /** `slots[dartId]` is the index of that dart inside its tail's ring. */
  readonly slots: readonly number[];
}

function buildDartRings(graph: PlanarWallGraph): DartRings {
  const rings = graph.vertices.map((vertex) =>
    vertex.edgeIds.map((edgeId) => {
      const edge = itemAt(graph.edges, edgeId);
      return edge.fromVertexId === vertex.id ? edgeId * 2 : edgeId * 2 + 1;
    }),
  );

  const slots = new Array<number>(graph.edges.length * 2).fill(0);
  rings.forEach((ring) => {
    ring.forEach((dart, slot) => {
      slots[dart] = slot;
    });
  });

  return { rings, slots };
}

/**
 * The next dart of the face, taking the sharpest available turn to the left.
 *
 * Arriving at a vertex, the walk looks at the way back it came in and takes the
 * neighbouring direction just clockwise of it. That is the same thing as turning
 * as far left as the drawing allows, and it is what keeps the enclosed area on
 * the left all the way round.
 */
function nextInFace(graph: PlanarWallGraph, rings: DartRings, dart: DartId): DartId {
  const back = twinOf(dart);
  const ring = itemAt(rings.rings, tailOf(graph, back));
  return cyclicAt(ring, itemAt(rings.slots, back) - 1);
}

/** Trace every face of the graph, each as the darts that bound it. */
function traceFaces(graph: PlanarWallGraph, rings: DartRings): readonly (readonly DartId[])[] {
  const visited = new Array<boolean>(graph.edges.length * 2).fill(false);
  const faces: DartId[][] = [];

  for (let start = 0; start < visited.length; start += 1) {
    if (itemAt(visited, start)) {
      continue;
    }
    const face: DartId[] = [];
    let dart = start;
    do {
      visited[dart] = true;
      face.push(dart);
      dart = nextInFace(graph, rings, dart);
    } while (dart !== start);
    faces.push(face);
  }

  return faces;
}

/**
 * Start the face at its bottom-left corner.
 *
 * A face is a cycle, so where the walk happened to enter it is an accident of
 * the order the walls arrived in. Rotating to the corner nearest the origin
 * makes the outline itself independent of that order, which is what lets two
 * runs over the same drawing be compared vertex by vertex.
 */
function rotateFace(graph: PlanarWallGraph, face: readonly DartId[]): readonly DartId[] {
  let best = 0;
  for (let index = 1; index < face.length; index += 1) {
    const candidate = positionOf(graph, tailOf(graph, itemAt(face, index)));
    const incumbent = positionOf(graph, tailOf(graph, itemAt(face, best)));
    const byX = compareNearly(candidate.x, incumbent.x);
    const byY = byX === 0 ? compareNearly(candidate.y, incumbent.y) : byX;
    if (byY < 0) {
      best = index;
    }
  }
  return face.map((_unused, index) => cyclicAt(face, best + index));
}

/** Twice the signed area of a closed outline, in square millimetres. */
function doubleSignedArea(outline: readonly PointMm[]): number {
  let total = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const current = itemAt(outline, index);
    const next = cyclicAt(outline, index + 1);
    total += current.x * next.y - next.x * current.y;
  }
  return total;
}

/** Signed area as an area, positive when the outline runs counter-clockwise. */
function signedAreaM2(outline: readonly PointMm[]): SquareMetres {
  return squareMetres(doubleSignedArea(outline) / 2 / SQUARE_MILLIMETRES_PER_SQUARE_METRE);
}

/**
 * The face of the wall this room is measured to.
 *
 * The room lies to the left of every dart, so pulling the centreline half a
 * thickness to the left lands exactly on the plaster the occupant can touch.
 * Direction is kept alongside the moved point because the corner is not this
 * point: it is where this line crosses the one before it.
 */
function clearFaceLine(graph: PlanarWallGraph, dart: DartId): OffsetLine {
  const from = positionOf(graph, tailOf(graph, dart));
  const to = positionOf(graph, headOf(graph, dart));
  const runX = to.x - from.x;
  const runY = to.y - from.y;
  const length = Math.hypot(runX, runY);
  const directionX = runX / length;
  const directionY = runY / length;
  const halfThickness = edgeOf(graph, dart).thicknessMm / 2;

  return {
    // The left normal of a direction of travel is the direction turned a
    // quarter turn counter-clockwise, which points into the room.
    origin: pointAt(from.x - directionY * halfThickness, from.y + directionX * halfThickness),
    directionX,
    directionY,
  };
}

/** Where two clear faces meet, or `null` when they run parallel and never do. */
function meetingOf(earlier: OffsetLine, later: OffsetLine): PointMm | null {
  const cross = earlier.directionX * later.directionY - earlier.directionY * later.directionX;
  if (isNearlyZero(cross)) {
    return null;
  }
  const offsetX = later.origin.x - earlier.origin.x;
  const offsetY = later.origin.y - earlier.origin.y;
  const along = (offsetX * later.directionY - offsetY * later.directionX) / cross;
  return pointAt(
    earlier.origin.x + along * earlier.directionX,
    earlier.origin.y + along * earlier.directionY,
  );
}

/**
 * Drop vertices that carry no shape.
 *
 * A wall cut in two by a partition on its far side leaves a vertex in the middle
 * of a straight boundary; it measures the same with or without it, and a reader
 * expects a rectangular room to have four corners. Three vertices are always
 * kept, whatever happens, so the outline stays a polygon.
 */
function simplifyOutline(points: readonly PointMm[]): readonly PointMm[] {
  const kept: PointMm[] = [];
  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (previous === undefined || !nearlyEqualPoint(previous, point)) {
      kept.push(point);
    }
  }
  const first = kept[0];
  const last = kept[kept.length - 1];
  if (kept.length > 1 && first !== undefined && last !== undefined && nearlyEqualPoint(first, last)) {
    kept.pop();
  }

  let outline: readonly PointMm[] = kept;
  let removedOne = true;
  while (removedOne && outline.length > 3) {
    removedOne = false;
    for (let index = 0; index < outline.length; index += 1) {
      const previous = cyclicAt(outline, index - 1);
      const current = itemAt(outline, index);
      const next = cyclicAt(outline, index + 1);
      const runX = next.x - previous.x;
      const runY = next.y - previous.y;
      const length = Math.hypot(runX, runY);
      const offLine =
        length === 0
          ? 0
          : Math.abs(runX * (current.y - previous.y) - runY * (current.x - previous.x)) / length;
      if (isNearlyZero(offLine)) {
        outline = outline.filter((_unused, other) => other !== index);
        removedOne = true;
        break;
      }
    }
  }

  return outline;
}

/** The room outline, measured to the inside face of every wall around it. */
function clearOutline(graph: PlanarWallGraph, face: readonly DartId[]): readonly PointMm[] {
  const lines = face.map((dart) => clearFaceLine(graph, dart));
  const corners = lines.map((line, index) => meetingOf(cyclicAt(lines, index - 1), line) ?? line.origin);
  return simplifyOutline(corners);
}

/**
 * Where a room sits, used only to put the list in a repeatable order.
 *
 * The corner is kept as plain numbers rather than a `PointMm`: an empty outline
 * would have no least corner at all, and a labelled length is not the place to
 * carry that.
 */
function leastCornerOf(outline: readonly PointMm[]): { readonly x: number; readonly y: number } {
  return outline.reduce<{ readonly x: number; readonly y: number }>(
    (corner, point) => ({ x: Math.min(corner.x, point.x), y: Math.min(corner.y, point.y) }),
    { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY },
  );
}

/** Left to right, then top to bottom, then by the walls that bound it. */
function compareRooms(first: DetectedRoom, second: DetectedRoom): number {
  const firstCorner = leastCornerOf(first.outline);
  const secondCorner = leastCornerOf(second.outline);
  const byX = compareNearly(firstCorner.x, secondCorner.x);
  if (byX !== 0) {
    return byX;
  }
  const byY = compareNearly(firstCorner.y, secondCorner.y);
  if (byY !== 0) {
    return byY;
  }
  const firstWalls = first.wallIds.join('+');
  const secondWalls = second.wallIds.join('+');
  return firstWalls < secondWalls ? -1 : firstWalls > secondWalls ? 1 : 0;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Find the rooms enclosed by a set of walls.
 *
 * The walls are expected to be one storey's worth: two levels of a building
 * traced into one list would have their walls crossing in plan and would close
 * faces that are not rooms anywhere.
 *
 * Rooms come back left to right and then top to bottom, each measured to the
 * clear face of the walls around it. Faces smaller than `minTrustedAreaM2` are
 * marked `suspect` and kept; the face outside the building is dropped, being
 * the one face the walk traces clockwise.
 *
 * @throws RangeError when a wall is unusable, or the weld gap is not positive.
 * @throws Error when two walls share an id.
 */
export function detectRooms(
  walls: readonly Wall[],
  options: DetectRoomsOptions = {},
): DetectRoomsResult {
  const graph = buildWallGraph(walls, options.weldGapMm ?? DEFAULT_WELD_GAP_MM);
  const minTrustedAreaM2 = options.minTrustedAreaM2 ?? MIN_TRUSTED_ROOM_AREA_M2;

  if (graph.edges.length === 0) {
    return { rooms: [], graph };
  }

  const rings = buildDartRings(graph);
  const rooms: DetectedRoom[] = [];

  for (const traced of traceFaces(graph, rings)) {
    const face = rotateFace(graph, traced);
    const centrelineOutline = face.map((dart) => positionOf(graph, tailOf(graph, dart)));
    if (compareNearly(signedAreaM2(centrelineOutline), squareMetres(0)) <= 0) {
      // A face the walk traces clockwise is the ground outside the building,
      // and there is exactly one per connected piece of the drawing: everything
      // enclosed comes out counter-clockwise, because the walk never turns
      // anything but left.
      continue;
    }

    const outline = clearOutline(graph, face);
    // A room narrower than the walls around it offsets itself inside out. The
    // shape is not a room, but it is still a face someone drew, so it is kept
    // at zero and flagged rather than thrown away.
    const areaM2 = squareMetres(Math.max(0, signedAreaM2(outline)));
    const wallIds = [...new Set(face.map((dart) => edgeOf(graph, dart).wallId))].sort();

    rooms.push({
      outline,
      centrelineOutline: simplifyOutline(centrelineOutline),
      areaM2,
      wallIds,
      trust: compareNearly(areaM2, minTrustedAreaM2) < 0 ? 'suspect' : 'trusted',
    });
  }

  return { rooms: rooms.sort(compareRooms), graph };
}

/** Total clear area of a set of rooms. */
export function totalRoomArea(rooms: readonly DetectedRoom[]): SquareMetres {
  return squareMetres(rooms.reduce((total, room) => total + room.areaM2, 0));
}
