/**
 * The planar graph a room search runs on.
 *
 * A wall list is not a graph. Walls cross each other, tee into the middle of a
 * run, stop a few millimetres short of the wall they were meant to touch, and
 * arrive in whatever order the tracer produced them. None of that can be handed
 * to a face-tracing algorithm, which needs the opposite: vertices that are
 * genuinely shared, edges that meet only at vertices, and a repeatable order
 * around each vertex.
 *
 * This module does that conversion, and only that. It answers four questions
 * about the drawing, in this order, because each one depends on the answer to
 * the last:
 *
 * 1. **Which ends are the same corner?** Ends closer together than the weld gap
 *    are one vertex, and the gap between them is closed rather than reported as
 *    a hole. Grouping is transitive, so three ends in a row each near the next
 *    become one corner even when the outer two are further apart.
 * 2. **Which ends belong on another wall?** An end that stops short of, or just
 *    past, the middle of another run is pulled onto it and splits it. This is
 *    what turns a drawing missing a nib of line into a closed room.
 * 3. **Where do runs cross?** Two walls that properly cross are cut at the
 *    crossing, so neither edge passes through the interior of the other.
 * 4. **Which edges can bound a room at all?** A run with a free end bounds
 *    nothing; it is pruned, and the walls it came from are reported so the
 *    interface can show them rather than silently losing them.
 *
 * Two things this module deliberately does not do. It does not offset anything:
 * every coordinate here is on a wall centreline, and the clear face is
 * `detect.ts`'s problem. And it repairs nothing structural — a wall whose
 * thickness or length makes it unusable throws, exactly as `walls/types` says
 * it should, because a graph built from a wall the model rejects would measure
 * a room that cannot be built.
 *
 * Everything is pure: no input wall or array is written to, and the same walls
 * always produce the same vertices and edges, down to the numbering.
 */

import { compareNearly, isNearlyZero, nearlyEqualPoint, type PointMm } from '../units/compare';
import { distanceBetween, perpendicularFoot } from '../units/snap';
import {
  millimetres,
  normaliseDegrees,
  radians,
  radiansToDegrees,
  type Degrees,
  type Millimetres,
} from '../units/types';
import type { WallId } from '../spatial/types';
import { assertUsableWall, endPoint, WALL_ENDS, type Wall, type WallEnd } from '../walls/types';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How wide a hole in the drawing may be and still be welded shut.
 *
 * Eighty millimetres is the width of the thinnest partition anyone draws, so a
 * gap that size is a missing stroke rather than a doorway. Anything wider is
 * left open, and the room simply does not close — which is the honest answer.
 */
export const DEFAULT_WELD_GAP_MM: Millimetres = millimetres(80);

/** A corner of the graph: a point several wall edges meet at. */
export interface GraphVertex {
  readonly id: number;
  readonly position: PointMm;
  /** Incident edges counter-clockwise by the bearing they leave in. */
  readonly edgeIds: readonly number[];
}

/** One piece of one wall, running between two vertices and crossing none. */
export interface GraphEdge {
  readonly id: number;
  readonly wallId: WallId;
  readonly thicknessMm: Millimetres;
  readonly fromVertexId: number;
  readonly toVertexId: number;
}

/** A hole in the drawing that was closed, reported so it can be reviewed. */
export interface WeldedGap {
  /** The walls whose ends were pulled together, sorted. */
  readonly wallIds: readonly WallId[];
  /** The widest distance closed inside the group. */
  readonly gapMm: Millimetres;
  /** Where the ends ended up. */
  readonly position: PointMm;
}

/** The graph, ready for a face search. */
export interface PlanarWallGraph {
  readonly vertices: readonly GraphVertex[];
  readonly edges: readonly GraphEdge[];
  readonly weldedGaps: readonly WeldedGap[];
  /** Walls that lost a piece to pruning: they have a free end somewhere. */
  readonly deadEndWallIds: readonly WallId[];
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** A wall centreline while it is being welded and cut. */
interface WorkingSegment {
  readonly wallId: WallId;
  readonly thicknessMm: Millimetres;
  start: PointMm;
  end: PointMm;
  /** Interior points this segment must be cut at. */
  readonly cuts: PointMm[];
}

/** One end of one working segment. */
interface EndpointRef {
  readonly segmentIndex: number;
  readonly end: WallEnd;
}

/** An end that has to be pulled onto the middle of another run. */
interface HostChoice {
  readonly endpoint: EndpointRef;
  readonly hostIndex: number;
  readonly gapMm: Millimetres;
}

/** A straight piece of a wall, after every cut has been applied. */
interface Piece {
  readonly wallId: WallId;
  readonly thicknessMm: Millimetres;
  readonly from: PointMm;
  readonly to: PointMm;
}

/**
 * Side of the bucket grid the vertex index uses, in millimetres.
 *
 * Any value comfortably larger than the equality tolerance works; one
 * millimetre keeps the buckets small while leaving a thousandfold margin over
 * the micrometre two points must be within to count as one vertex.
 */
const VERTEX_BUCKET_MM = 1;

/** How far clear of an end a cut has to fall to be worth making. */
const CUT_MARGIN_MM = 0.001;

function itemAt<TItem>(items: readonly TItem[], index: number): TItem {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(
      `Index ${String(index)} falls outside a list of ${String(items.length)} items.`,
    );
  }
  return item;
}

function pointAt(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

/** Direction a straight run leaves `from` in, within `[0, 360)`. */
export function bearingBetween(from: PointMm, to: PointMm): Degrees {
  return normaliseDegrees(radiansToDegrees(radians(Math.atan2(to.y - from.y, to.x - from.x))));
}

function readEndpoint(segments: readonly WorkingSegment[], ref: EndpointRef): PointMm {
  const segment = itemAt(segments, ref.segmentIndex);
  return ref.end === 'start' ? segment.start : segment.end;
}

function writeEndpoint(segments: readonly WorkingSegment[], ref: EndpointRef, point: PointMm): void {
  const segment = itemAt(segments, ref.segmentIndex);
  if (ref.end === 'start') {
    segment.start = point;
  } else {
    segment.end = point;
  }
}

/**
 * Turn the walls into segments, rejecting the ones the geometry cannot use.
 *
 * Duplicate ids are refused here rather than deduplicated: two walls sharing an
 * id make every later lookup ambiguous, and a room would end up crediting one
 * wall for a boundary the other drew.
 *
 * @throws RangeError when a wall is unusable.
 * @throws Error when two walls share an id.
 */
function collectSegments(walls: readonly Wall[]): WorkingSegment[] {
  const seen = new Set<WallId>();

  return walls.map((wall) => {
    assertUsableWall(wall);
    if (seen.has(wall.id)) {
      throw new Error(`Wall id ${wall.id} appears more than once.`);
    }
    seen.add(wall.id);

    return {
      wallId: wall.id,
      thicknessMm: wall.thicknessMm,
      start: endPoint(wall, 'start'),
      end: endPoint(wall, 'end'),
      cuts: [],
    };
  });
}

function collectEndpoints(segments: readonly WorkingSegment[]): EndpointRef[] {
  return segments.flatMap((_unused, segmentIndex) =>
    WALL_ENDS.map((end) => ({ segmentIndex, end })),
  );
}

/**
 * Pull ends that sit within the weld gap of each other onto one point.
 *
 * The two ends of a single wall are never welded to each other: a wall short
 * enough for that is a tracing artefact, and collapsing it would delete a piece
 * of the drawing instead of reporting it.
 */
function weldEndpointClusters(
  segments: readonly WorkingSegment[],
  weldGapMm: Millimetres,
  welds: WeldedGap[],
): void {
  const endpoints = collectEndpoints(segments);
  const parents = endpoints.map((_unused, index) => index);

  const rootOf = (index: number): number => {
    let current = index;
    let parent = itemAt(parents, current);
    while (parent !== current) {
      current = parent;
      parent = itemAt(parents, current);
    }
    return current;
  };

  const merge = (first: number, second: number): void => {
    const firstRoot = rootOf(first);
    const secondRoot = rootOf(second);
    if (firstRoot !== secondRoot) {
      parents[Math.max(firstRoot, secondRoot)] = Math.min(firstRoot, secondRoot);
    }
  };

  for (let first = 0; first < endpoints.length; first += 1) {
    for (let second = first + 1; second < endpoints.length; second += 1) {
      const one = itemAt(endpoints, first);
      const other = itemAt(endpoints, second);
      if (one.segmentIndex === other.segmentIndex) {
        continue;
      }
      const gapMm = distanceBetween(readEndpoint(segments, one), readEndpoint(segments, other));
      if (compareNearly(gapMm, weldGapMm) <= 0) {
        merge(first, second);
      }
    }
  }

  const groups = new Map<number, EndpointRef[]>();
  endpoints.forEach((ref, index) => {
    const root = rootOf(index);
    const group = groups.get(root);
    if (group === undefined) {
      groups.set(root, [ref]);
    } else {
      group.push(ref);
    }
  });

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const before = group.map((ref) => readEndpoint(segments, ref));
    const total = before.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), {
      x: 0,
      y: 0,
    });
    const centre = pointAt(total.x / before.length, total.y / before.length);

    let widestMm = 0;
    for (let first = 0; first < before.length; first += 1) {
      for (let second = first + 1; second < before.length; second += 1) {
        widestMm = Math.max(widestMm, distanceBetween(itemAt(before, first), itemAt(before, second)));
      }
    }

    for (const ref of group) {
      writeEndpoint(segments, ref, centre);
    }

    if (!isNearlyZero(widestMm)) {
      const wallIds = [...new Set(group.map((ref) => itemAt(segments, ref.segmentIndex).wallId))].sort();
      welds.push({ wallIds, gapMm: millimetres(widestMm), position: centre });
    }
  }
}

/** Is this point on the run without being either of its ends? */
function isInteriorPoint(segment: WorkingSegment, point: PointMm): boolean {
  return !nearlyEqualPoint(point, segment.start) && !nearlyEqualPoint(point, segment.end);
}

/**
 * Choose, for every end still free, the run it was meant to touch.
 *
 * Choices are made against one frozen picture of the drawing rather than as the
 * ends move, so the answer does not depend on which wall the tracer happened to
 * emit first. The nearest run wins; the wall id settles a tie, so two runs at
 * the same distance always resolve the same way.
 */
function chooseHosts(
  segments: readonly WorkingSegment[],
  weldGapMm: Millimetres,
): readonly HostChoice[] {
  const choices: HostChoice[] = [];

  for (const endpoint of collectEndpoints(segments)) {
    const point = readEndpoint(segments, endpoint);
    let best: HostChoice | null = null;

    for (let hostIndex = 0; hostIndex < segments.length; hostIndex += 1) {
      if (hostIndex === endpoint.segmentIndex) {
        continue;
      }
      const host = itemAt(segments, hostIndex);
      const foot = perpendicularFoot(point, host);
      if (foot === null || !isInteriorPoint(host, foot)) {
        continue;
      }
      const gapMm = distanceBetween(point, foot);
      if (compareNearly(gapMm, weldGapMm) > 0) {
        continue;
      }
      if (best === null) {
        best = { endpoint, hostIndex, gapMm };
        continue;
      }
      const byGap = compareNearly(gapMm, best.gapMm);
      if (byGap < 0 || (byGap === 0 && host.wallId < itemAt(segments, best.hostIndex).wallId)) {
        best = { endpoint, hostIndex, gapMm };
      }
    }

    if (best !== null) {
      choices.push(best);
    }
  }

  return choices;
}

/** Move each chosen end onto its run, and record the cut the run needs. */
function weldEndpointsOntoRuns(
  segments: readonly WorkingSegment[],
  choices: readonly HostChoice[],
  welds: WeldedGap[],
): void {
  for (const choice of choices) {
    const host = itemAt(segments, choice.hostIndex);
    const moved = itemAt(segments, choice.endpoint.segmentIndex);
    const point = readEndpoint(segments, choice.endpoint);
    const foot = perpendicularFoot(point, host);
    if (foot === null || !isInteriorPoint(host, foot)) {
      continue;
    }

    writeEndpoint(segments, choice.endpoint, foot);
    host.cuts.push(foot);

    const gapMm = distanceBetween(point, foot);
    if (!isNearlyZero(gapMm)) {
      welds.push({
        wallIds: [moved.wallId, host.wallId].sort(),
        gapMm: millimetres(gapMm),
        position: foot,
      });
    }
  }
}

/**
 * Cut both runs wherever two of them properly cross.
 *
 * Only a genuine crossing counts: touching at an end is already a shared
 * vertex, and two runs along the same line have no single crossing point to
 * name. The parameter margins are absolute rather than fractional so a long run
 * and a short one are judged by the same micrometre.
 */
function cutAtCrossings(segments: readonly WorkingSegment[]): void {
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      const one = itemAt(segments, first);
      const other = itemAt(segments, second);

      const oneRunX = one.end.x - one.start.x;
      const oneRunY = one.end.y - one.start.y;
      const otherRunX = other.end.x - other.start.x;
      const otherRunY = other.end.y - other.start.y;

      const oneLength = Math.hypot(oneRunX, oneRunY);
      const otherLength = Math.hypot(otherRunX, otherRunY);
      const cross = oneRunX * otherRunY - oneRunY * otherRunX;
      if (isNearlyZero(cross / (oneLength * otherLength))) {
        continue;
      }

      const offsetX = other.start.x - one.start.x;
      const offsetY = other.start.y - one.start.y;
      const alongOne = (offsetX * otherRunY - offsetY * otherRunX) / cross;
      const alongOther = (offsetX * oneRunY - offsetY * oneRunX) / cross;

      const insideOne = isStrictlyAlong(alongOne, oneLength);
      const insideOther = isStrictlyAlong(alongOther, otherLength);
      if (!insideOne || !insideOther) {
        continue;
      }

      const meeting = pointAt(one.start.x + alongOne * oneRunX, one.start.y + alongOne * oneRunY);
      one.cuts.push(meeting);
      other.cuts.push(meeting);
    }
  }
}

/** Is a parameter inside a run of this length, clear of both ends? */
function isStrictlyAlong(along: number, lengthMm: number): boolean {
  const margin = lengthMm === 0 ? 0 : Math.abs(CUT_MARGIN_MM / lengthMm);
  return along > margin && along < 1 - margin;
}

/** Break one segment at its cuts, in order along the run. */
function sliceSegment(segment: WorkingSegment): Piece[] {
  const runX = segment.end.x - segment.start.x;
  const runY = segment.end.y - segment.start.y;
  const lengthSquared = runX * runX + runY * runY;

  const alongOf = (point: PointMm): number =>
    ((point.x - segment.start.x) * runX + (point.y - segment.start.y) * runY) / lengthSquared;

  const stops = [
    { along: 0, point: segment.start },
    ...segment.cuts.map((point) => ({ along: alongOf(point), point })),
    { along: 1, point: segment.end },
  ].sort((first, second) => compareNearly(first.along, second.along));

  const pieces: Piece[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const from = itemAt(stops, index - 1).point;
    const to = itemAt(stops, index).point;
    if (nearlyEqualPoint(from, to)) {
      continue;
    }
    pieces.push({ wallId: segment.wallId, thicknessMm: segment.thicknessMm, from, to });
  }

  return pieces;
}

/**
 * A running index of vertices, so the same coordinate always gets the same id.
 *
 * Points are bucketed on a one-millimetre grid and only the nine buckets around
 * a query are searched, which keeps the lookup flat as the drawing grows rather
 * than comparing every point with every other.
 */
interface VertexIndex {
  readonly positions: PointMm[];
  readonly buckets: Map<string, number[]>;
}

function createVertexIndex(): VertexIndex {
  return { positions: [], buckets: new Map() };
}

function bucketKey(cellX: number, cellY: number): string {
  return `${String(cellX)}|${String(cellY)}`;
}

function vertexIdFor(index: VertexIndex, point: PointMm): number {
  const cellX = Math.round(point.x / VERTEX_BUCKET_MM);
  const cellY = Math.round(point.y / VERTEX_BUCKET_MM);

  for (let stepX = -1; stepX <= 1; stepX += 1) {
    for (let stepY = -1; stepY <= 1; stepY += 1) {
      const bucket = index.buckets.get(bucketKey(cellX + stepX, cellY + stepY));
      if (bucket === undefined) {
        continue;
      }
      for (const candidate of bucket) {
        if (nearlyEqualPoint(itemAt(index.positions, candidate), point)) {
          return candidate;
        }
      }
    }
  }

  const id = index.positions.length;
  index.positions.push(point);
  const key = bucketKey(cellX, cellY);
  const bucket = index.buckets.get(key);
  if (bucket === undefined) {
    index.buckets.set(key, [id]);
  } else {
    bucket.push(id);
  }
  return id;
}

/** An edge under construction, before dead ends are pruned. */
interface DraftEdge {
  readonly wallId: WallId;
  readonly thicknessMm: Millimetres;
  readonly fromVertexId: number;
  readonly toVertexId: number;
}

function undirectedKey(first: number, second: number): string {
  return first < second ? `${String(first)}-${String(second)}` : `${String(second)}-${String(first)}`;
}

/**
 * Turn pieces into edges, dropping the ones that cannot bound anything.
 *
 * A piece whose ends welded onto the same vertex has no length left and is
 * dropped; a second piece between a pair of vertices that already have an edge
 * is a wall drawn twice, and only the first is kept — two parallel edges would
 * enclose a face of zero area and invent a room out of nothing.
 */
function draftEdges(pieces: readonly Piece[], index: VertexIndex): DraftEdge[] {
  const taken = new Set<string>();
  const edges: DraftEdge[] = [];

  for (const piece of pieces) {
    const fromVertexId = vertexIdFor(index, piece.from);
    const toVertexId = vertexIdFor(index, piece.to);
    if (fromVertexId === toVertexId) {
      continue;
    }
    const key = undirectedKey(fromVertexId, toVertexId);
    if (taken.has(key)) {
      continue;
    }
    taken.add(key);
    edges.push({
      wallId: piece.wallId,
      thicknessMm: piece.thicknessMm,
      fromVertexId,
      toVertexId,
    });
  }

  return edges;
}

/**
 * Remove edges that lead nowhere, repeatedly, until every vertex has two.
 *
 * A run with a free end cannot be part of a cycle, so it cannot bound a room;
 * removing it can free the run it hung off, which is why this repeats. The
 * walls involved are reported instead of being forgotten: a partition drawn one
 * stroke short is a defect to show, not a fact to hide.
 */
function pruneDeadEnds(edges: readonly DraftEdge[]): {
  readonly kept: readonly DraftEdge[];
  readonly deadEndWallIds: readonly WallId[];
} {
  const alive = edges.map(() => true);
  const degree = new Map<number, number>();
  const incident = new Map<number, number[]>();

  const bump = (vertexId: number, by: number): number => {
    const next = (degree.get(vertexId) ?? 0) + by;
    degree.set(vertexId, next);
    return next;
  };

  edges.forEach((edge, edgeId) => {
    for (const vertexId of [edge.fromVertexId, edge.toVertexId]) {
      bump(vertexId, 1);
      const list = incident.get(vertexId);
      if (list === undefined) {
        incident.set(vertexId, [edgeId]);
      } else {
        list.push(edgeId);
      }
    }
  });

  const queue = [...degree.entries()].filter(([, count]) => count === 1).map(([vertexId]) => vertexId);
  const dead = new Set<WallId>();

  while (queue.length > 0) {
    const vertexId = queue.pop();
    if (vertexId === undefined || (degree.get(vertexId) ?? 0) !== 1) {
      continue;
    }

    for (const edgeId of incident.get(vertexId) ?? []) {
      if (!itemAt(alive, edgeId)) {
        continue;
      }
      const edge = itemAt(edges, edgeId);
      alive[edgeId] = false;
      dead.add(edge.wallId);
      bump(edge.fromVertexId, -1);
      bump(edge.toVertexId, -1);
      const otherId = edge.fromVertexId === vertexId ? edge.toVertexId : edge.fromVertexId;
      if ((degree.get(otherId) ?? 0) === 1) {
        queue.push(otherId);
      }
    }
  }

  return {
    kept: edges.filter((_unused, edgeId) => itemAt(alive, edgeId)),
    deadEndWallIds: [...dead].sort(),
  };
}

/**
 * Order the edges around each vertex, counter-clockwise from due east.
 *
 * The order is what makes the face walk repeatable, so the tie-break matters:
 * two edges leaving in the same direction — a short wall drawn over a long one —
 * fall back to the edge number rather than to floating-point noise.
 */
function orderAroundVertices(
  edges: readonly GraphEdge[],
  positions: readonly PointMm[],
): GraphVertex[] {
  const incident = positions.map((): number[] => []);

  for (const edge of edges) {
    itemAt(incident, edge.fromVertexId).push(edge.id);
    itemAt(incident, edge.toVertexId).push(edge.id);
  }

  return positions.map((position, id) => {
    const bearingOf = (edgeId: number): Degrees => {
      const edge = itemAt(edges, edgeId);
      const otherId = edge.fromVertexId === id ? edge.toVertexId : edge.fromVertexId;
      return bearingBetween(position, itemAt(positions, otherId));
    };

    const edgeIds = [...itemAt(incident, id)].sort((first, second) => {
      const byBearing = compareNearly(bearingOf(first), bearingOf(second));
      return byBearing !== 0 ? byBearing : first - second;
    });

    return { id, position, edgeIds };
  });
}

/* -------------------------------------------------------------------------- */
/* Public function.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Build the planar graph the room search walks.
 *
 * Every edge is a straight piece of exactly one wall, running between two
 * vertices and passing through no other; every vertex lists its edges
 * counter-clockwise, so a face walk gets the same answer on every run. Walls
 * that end up bounding nothing are reported in `deadEndWallIds`, and holes the
 * weld closed are reported in `weldedGaps`, so neither is lost.
 *
 * @throws RangeError when a wall is unusable, or the weld gap is not positive.
 * @throws Error when two walls share an id.
 */
export function buildWallGraph(
  walls: readonly Wall[],
  weldGapMm: Millimetres = DEFAULT_WELD_GAP_MM,
): PlanarWallGraph {
  if (!Number.isFinite(weldGapMm) || weldGapMm <= 0) {
    throw new RangeError(`Weld gap must be a positive length: ${String(weldGapMm)}`);
  }

  const segments = collectSegments(walls);
  const weldedGaps: WeldedGap[] = [];

  weldEndpointClusters(segments, weldGapMm, weldedGaps);
  weldEndpointsOntoRuns(segments, chooseHosts(segments, weldGapMm), weldedGaps);
  cutAtCrossings(segments);

  const index = createVertexIndex();
  const drafts = draftEdges(segments.flatMap(sliceSegment), index);
  const { kept, deadEndWallIds } = pruneDeadEnds(drafts);

  // Renumber, so a caller never sees an id belonging to a pruned vertex.
  const usedVertexIds = [...new Set(kept.flatMap((edge) => [edge.fromVertexId, edge.toVertexId]))].sort(
    (first, second) => first - second,
  );
  const newIdOf = new Map(usedVertexIds.map((oldId, newId) => [oldId, newId]));
  const idOf = (oldId: number): number => {
    const newId = newIdOf.get(oldId);
    if (newId === undefined) {
      throw new RangeError(`Vertex ${String(oldId)} survived pruning without a number.`);
    }
    return newId;
  };

  const edges: GraphEdge[] = kept.map((edge, id) => ({
    id,
    wallId: edge.wallId,
    thicknessMm: edge.thicknessMm,
    fromVertexId: idOf(edge.fromVertexId),
    toVertexId: idOf(edge.toVertexId),
  }));
  const positions = usedVertexIds.map((oldId) => itemAt(index.positions, oldId));

  return {
    vertices: orderAroundVertices(edges, positions),
    edges,
    weldedGaps,
    deadEndWallIds,
  };
}
