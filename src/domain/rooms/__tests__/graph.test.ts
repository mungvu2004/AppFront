import { describe, expect, it } from 'vitest';

import type { WallId } from '../../spatial/types';
import type { PointMm } from '../../units/compare';
import { millimetres, type Millimetres } from '../../units/types';
import type { Wall } from '../../walls/types';
import { buildWallGraph, type PlanarWallGraph } from '../graph';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_THICKNESS_MM: Millimetres = millimetres(200);

/**
 * A weld gap small enough to leave two cuts five millimetres apart standing.
 *
 * The shipped eighty millimetres would pull them into one corner, which is the
 * right answer for a drawing and the wrong one for this test: what is under
 * test is how two *distinct* cuts a few millimetres apart are ordered.
 */
const TIGHT_WELD_GAP_MM: Millimetres = millimetres(1);

function point(x: number, y: number): PointMm {
  return { x: millimetres(x), y: millimetres(y) };
}

function makeWall(id: WallId, from: PointMm, to: PointMm): Wall {
  return {
    id,
    kind: 'partition',
    centreline: { start: from, end: to },
    thicknessMm: DEFAULT_THICKNESS_MM,
    baseElevationMm: millimetres(0),
    topElevationMm: millimetres(3000),
  };
}

/**
 * A ten metre room split by two partitions five millimetres apart.
 *
 * Five millimetres out of ten metres is 0,0005 as a fraction — half the
 * domain's millimetre epsilon once that epsilon is read as a fraction, and so
 * the narrowest slice that the old ordering called "the same stop".
 */
const WALLS_CUT_TWICE: readonly Wall[] = [
  makeWall('W-bottom' as WallId, point(0, 0), point(10000, 0)),
  makeWall('W-right' as WallId, point(10000, 0), point(10000, 6000)),
  makeWall('W-top' as WallId, point(10000, 6000), point(0, 6000)),
  makeWall('W-left' as WallId, point(0, 6000), point(0, 0)),
  makeWall('W-split-a' as WallId, point(5000, 0), point(5000, 6000)),
  makeWall('W-split-b' as WallId, point(5005, 0), point(5005, 6000)),
];

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

function positionOf(graph: PlanarWallGraph, vertexId: number): PointMm {
  const vertex = graph.vertices[vertexId];
  if (vertex === undefined) {
    throw new RangeError(`Vertex ${String(vertexId)} is not in the graph.`);
  }
  return vertex.position;
}

/** Every edge as `wall from -> to`, sorted, so two graphs compare as sets. */
function describeEdges(graph: PlanarWallGraph): string[] {
  return graph.edges
    .map((edge) => {
      const from = positionOf(graph, edge.fromVertexId);
      const to = positionOf(graph, edge.toVertexId);
      return `${edge.wallId} ${from.x.toFixed(3)},${from.y.toFixed(3)} -> ${to.x.toFixed(3)},${to.y.toFixed(3)}`;
    })
    .sort();
}

/** How far along its own wall each end of each edge falls, in millimetres. */
function piecesOfWall(
  graph: PlanarWallGraph,
  walls: readonly Wall[],
  wallId: WallId,
): { fromMm: number; toMm: number }[] {
  const wall = walls.find((candidate) => candidate.id === wallId);
  if (wall === undefined) {
    throw new RangeError(`No wall ${wallId} in the fixture.`);
  }

  const runX = wall.centreline.end.x - wall.centreline.start.x;
  const runY = wall.centreline.end.y - wall.centreline.start.y;
  const lengthMm = Math.hypot(runX, runY);
  const alongMmOf = (at: PointMm): number =>
    ((at.x - wall.centreline.start.x) * runX + (at.y - wall.centreline.start.y) * runY) / lengthMm;

  return graph.edges
    .filter((edge) => edge.wallId === wallId)
    .map((edge) => ({
      fromMm: alongMmOf(positionOf(graph, edge.fromVertexId)),
      toMm: alongMmOf(positionOf(graph, edge.toVertexId)),
    }))
    .sort((first, second) => first.fromMm - second.fromMm);
}

/* -------------------------------------------------------------------------- */
/* Tests.                                                                      */
/* -------------------------------------------------------------------------- */

describe('buildWallGraph, on cuts a few millimetres apart', () => {
  it('gives the same graph whichever order the walls arrive in', () => {
    const forward = describeEdges(buildWallGraph(WALLS_CUT_TWICE, TIGHT_WELD_GAP_MM));
    const backward = describeEdges(
      buildWallGraph([...WALLS_CUT_TWICE].reverse(), TIGHT_WELD_GAP_MM),
    );

    expect(forward).toEqual(backward);
  });

  it('keeps both cuts rather than folding them into one', () => {
    const pieces = piecesOfWall(
      buildWallGraph(WALLS_CUT_TWICE, TIGHT_WELD_GAP_MM),
      WALLS_CUT_TWICE,
      'W-bottom' as WallId,
    );

    expect(pieces).toHaveLength(3);
  });

  it.each([
    ['drawn order', WALLS_CUT_TWICE],
    ['reverse order', [...WALLS_CUT_TWICE].reverse()],
  ])('tiles the cut wall end to end without overlapping itself: %s', (_name, walls) => {
    const pieces = piecesOfWall(buildWallGraph(walls, TIGHT_WELD_GAP_MM), walls, 'W-bottom' as WallId);

    // Each piece runs forwards, and the next one starts where the last stopped:
    // the ordering bug showed up as a piece running backwards and two pieces
    // covering the same millimetres twice.
    let reached = 0;
    for (const piece of pieces) {
      expect(piece.toMm).toBeGreaterThan(piece.fromMm);
      expect(piece.fromMm).toBeCloseTo(reached, 6);
      reached = piece.toMm;
    }
    expect(reached).toBeCloseTo(10000, 6);
  });

  it('cuts both partitions in, not just whichever came first', () => {
    const graph = buildWallGraph(WALLS_CUT_TWICE, TIGHT_WELD_GAP_MM);
    const wallIds = new Set(graph.edges.map((edge) => edge.wallId));

    expect(wallIds.has('W-split-a' as WallId)).toBe(true);
    expect(wallIds.has('W-split-b' as WallId)).toBe(true);
  });
});
