/**
 * The CAD rubber band: drag one way and you catch what you enclosed, drag the
 * other and you catch what you touched.
 *
 * The convention is the one every drafter already has in their fingers, and it
 * is decided by the drag direction alone:
 *
 * - **left to right — a window.** Only objects lying *entirely* inside the box
 *   are caught. A wall running out of the box is left alone.
 * - **right to left — a crossing.** Every object the box *touches* is caught,
 *   including one that merely clips a corner and one that swallows the box
 *   whole, such as a room the drag happened inside of.
 *
 * The two directions are read from `end.x` against `start.x`; the height of the
 * drag and the order of the corners play no part, which is why a drag up-left
 * and a drag down-left both give a crossing.
 *
 * Each object is tested against its **footprint** — the shape it actually
 * covers on the plan, not its bounding box. A wall is the rectangle its
 * thickness sweeps along the centreline, an opening is the stretch of that
 * rectangle it occupies, a piece of furniture is its box turned by its own
 * rotation, a room is its outline. Testing bounding boxes instead would catch a
 * diagonal wall that passes nowhere near the drag.
 *
 * Eligibility is not restated here: every candidate goes through
 * `isSelectable`, so a locked layer, a hidden layer and another floor are
 * filtered out on this path exactly as they are on a pick.
 */

import { isEntityOfKind, idsOnLevel, type SpatialEntity } from '@/domain/spatial/normalize';
import type {
  BoundingBox,
  EntityId,
  Furniture,
  Opening,
  Point,
  Segment,
  Wall,
} from '@/domain/spatial/types';
import { isNearlyZero } from '@/domain/units/compare';
import { degrees, degreesToRadians } from '@/domain/units/types';

import {
  combineSelection,
  isSelectable,
  type Selection,
  type SelectionCombine,
  type SelectionContext,
} from './selectionOps';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/** Which of the two CAD rules a drag follows. */
export type MarqueeMode = 'window' | 'crossing';

/** A drag, from the corner it started at to the corner the pointer is on. */
export interface Marquee {
  readonly start: Point;
  readonly end: Point;
}

/**
 * The ground an object covers on the plan.
 *
 * `closed` marks a shape whose last point joins its first — a wall rectangle, a
 * room outline — as opposed to a run of line such as an axis or a dimension.
 * The distinction matters twice: a closed shape has one more edge, and a closed
 * shape can contain the drag box without any edge crossing it.
 */
interface Footprint {
  readonly points: readonly Point[];
  readonly closed: boolean;
}

/**
 * Slack allowed when a point is tested against the box, in millimetres.
 *
 * Coordinates are whole millimetres, but a rotated piece of furniture lands on
 * fractions, and an object sitting exactly on the edge of the drag must not be
 * lost to the last bit of a sine.
 */
const TOUCH_TOLERANCE_MM = 0.001;

/* -------------------------------------------------------------------------- */
/* The drag itself.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Reads the CAD rule from the drag direction.
 *
 * A drag with no horizontal travel is read as a window, the stricter of the
 * two: a rule that catches everything it touches should be asked for, never
 * arrived at by accident.
 */
export const marqueeMode = (marquee: Marquee): MarqueeMode =>
  marquee.end.x >= marquee.start.x ? 'window' : 'crossing';

/** The drag as an axis-aligned box, corners sorted. */
export const marqueeBox = (marquee: Marquee): BoundingBox => ({
  max: { x: Math.max(marquee.start.x, marquee.end.x), y: Math.max(marquee.start.y, marquee.end.y) },
  min: { x: Math.min(marquee.start.x, marquee.end.x), y: Math.min(marquee.start.y, marquee.end.y) },
});

/* -------------------------------------------------------------------------- */
/* Footprints.                                                                 */
/* -------------------------------------------------------------------------- */

const rectangleAlong = (
  from: Point,
  to: Point,
  acrossX: number,
  acrossY: number,
): readonly Point[] => [
  { x: from.x + acrossX, y: from.y + acrossY },
  { x: to.x + acrossX, y: to.y + acrossY },
  { x: to.x - acrossX, y: to.y - acrossY },
  { x: from.x - acrossX, y: from.y - acrossY },
];

/** Unit vector along a segment, or `null` when the segment has no length. */
const directionOf = (segment: Segment): Point | null => {
  const runX = segment.end.x - segment.start.x;
  const runY = segment.end.y - segment.start.y;
  const length = Math.hypot(runX, runY);

  return isNearlyZero(length) ? null : { x: runX / length, y: runY / length };
};

/** The rectangle a wall's thickness sweeps along its centreline. */
const wallFootprint = (wall: Wall): Footprint => {
  const direction = directionOf(wall.centreline);

  if (direction === null) {
    return { closed: false, points: [wall.centreline.start] };
  }

  const half = wall.thicknessMm / 2;

  return {
    closed: true,
    points: rectangleAlong(
      wall.centreline.start,
      wall.centreline.end,
      -direction.y * half,
      direction.x * half,
    ),
  };
};

/**
 * The stretch of wall an opening occupies.
 *
 * The offset and width are taken as stored and are not clipped to the wall's
 * length: whether an opening overruns its host is a question for the integrity
 * check, and a marquee should report the geometry the drawing actually holds.
 * An opening whose host wall is missing has no footprint and is never caught.
 */
const openingFootprint = (
  opening: Opening,
  byId: Readonly<Record<string, SpatialEntity>>,
): Footprint | null => {
  const wall = byId[opening.wallId];

  if (wall === undefined || !isEntityOfKind('wall', wall)) {
    return null;
  }

  const direction = directionOf(wall.centreline);

  if (direction === null) {
    return null;
  }

  const { start } = wall.centreline;
  const far = opening.offsetMm + opening.widthMm;
  const half = wall.thicknessMm / 2;

  return {
    closed: true,
    points: rectangleAlong(
      { x: start.x + direction.x * opening.offsetMm, y: start.y + direction.y * opening.offsetMm },
      { x: start.x + direction.x * far, y: start.y + direction.y * far },
      -direction.y * half,
      direction.x * half,
    ),
  };
};

const cornersOf = (box: BoundingBox): readonly Point[] => [
  { x: box.min.x, y: box.min.y },
  { x: box.max.x, y: box.min.y },
  { x: box.max.x, y: box.max.y },
  { x: box.min.x, y: box.max.y },
];

/** A furniture box, turned about its own centre by its rotation. */
const furnitureFootprint = (item: Furniture): Footprint => {
  const corners = cornersOf(item.boundingBox);
  const angle = degreesToRadians(degrees(item.rotationDeg));

  if (isNearlyZero(angle)) {
    return { closed: true, points: corners };
  }

  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  return {
    closed: true,
    points: corners.map((corner) => {
      const offsetX = corner.x - item.centre.x;
      const offsetY = corner.y - item.centre.y;

      return {
        x: item.centre.x + offsetX * cos - offsetY * sin,
        y: item.centre.y + offsetX * sin + offsetY * cos,
      };
    }),
  };
};

const runFootprint = (line: Segment): Footprint => ({
  closed: false,
  points: [line.start, line.end],
});

/**
 * The ground one entity covers, or `null` when it covers none.
 *
 * A level has no footprint: it is a container rather than something drawn.
 */
const footprintOf = (
  entity: SpatialEntity,
  byId: Readonly<Record<string, SpatialEntity>>,
): Footprint | null => {
  if (isEntityOfKind('wall', entity)) {
    return wallFootprint(entity);
  }

  if (isEntityOfKind('opening', entity)) {
    return openingFootprint(entity, byId);
  }

  if (isEntityOfKind('furniture', entity)) {
    return furnitureFootprint(entity);
  }

  if (isEntityOfKind('room', entity)) {
    return { closed: entity.outline.length >= 3, points: entity.outline };
  }

  if (isEntityOfKind('axis', entity)) {
    return runFootprint(entity.line);
  }

  if (isEntityOfKind('dimension', entity)) {
    return runFootprint(entity.line);
  }

  return null;
};

/* -------------------------------------------------------------------------- */
/* Geometry.                                                                   */
/* -------------------------------------------------------------------------- */

const isPointInBox = (point: Point, box: BoundingBox): boolean =>
  point.x >= box.min.x - TOUCH_TOLERANCE_MM &&
  point.x <= box.max.x + TOUCH_TOLERANCE_MM &&
  point.y >= box.min.y - TOUCH_TOLERANCE_MM &&
  point.y <= box.max.y + TOUCH_TOLERANCE_MM;

/**
 * Does this segment share any ground with the box?
 *
 * The segment is clipped against the four sides in turn and anything surviving
 * lies inside. A segment wholly within the box survives untouched, which is the
 * case a corner-by-corner test alone would miss.
 *
 * Each side is given away by the touch tolerance, so a segment lying exactly on
 * an edge of the drag counts as meeting it.
 */
const doesSegmentMeetBox = (segment: Segment, box: BoundingBox): boolean => {
  const runX = segment.end.x - segment.start.x;
  const runY = segment.end.y - segment.start.y;
  let entry = 0;
  let exit = 1;

  // `room` already carries the tolerance, so a parallel run only has to stay on
  // the inner side of the widened edge.
  const clip = (edge: number, room: number): boolean => {
    if (isNearlyZero(edge)) {
      return room >= 0;
    }

    const at = room / edge;

    if (edge < 0) {
      if (at > exit) {
        return false;
      }

      entry = Math.max(entry, at);
    } else {
      if (at < entry) {
        return false;
      }

      exit = Math.min(exit, at);
    }

    return true;
  };

  return (
    clip(-runX, segment.start.x - box.min.x + TOUCH_TOLERANCE_MM) &&
    clip(runX, box.max.x - segment.start.x + TOUCH_TOLERANCE_MM) &&
    clip(-runY, segment.start.y - box.min.y + TOUCH_TOLERANCE_MM) &&
    clip(runY, box.max.y - segment.start.y + TOUCH_TOLERANCE_MM) &&
    entry <= exit
  );
};

/** The edges of a footprint; a closed shape gets the one back to its start. */
const edgesOf = (footprint: Footprint): Segment[] => {
  const { closed, points } = footprint;
  const limit = closed ? points.length : points.length - 1;
  const edges: Segment[] = [];

  for (let index = 0; index < limit; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];

    if (start !== undefined && end !== undefined) {
      edges.push({ end, start });
    }
  }

  return edges;
};

/** Ray casting: does the outline enclose this point? */
const isPointInOutline = (point: Point, outline: readonly Point[]): boolean => {
  let inside = false;

  for (let index = 0; index < outline.length; index += 1) {
    const corner = outline[index];
    const previous = outline[(index + outline.length - 1) % outline.length];

    if (corner === undefined || previous === undefined) {
      continue;
    }

    const straddles = corner.y > point.y !== previous.y > point.y;

    if (
      straddles &&
      point.x <
        ((previous.x - corner.x) * (point.y - corner.y)) / (previous.y - corner.y) + corner.x
    ) {
      inside = !inside;
    }
  }

  return inside;
};

/** The window rule: every corner of the footprint lies inside the box. */
const isFootprintEnclosed = (footprint: Footprint, box: BoundingBox): boolean =>
  footprint.points.length > 0 && footprint.points.every((point) => isPointInBox(point, box));

/**
 * The crossing rule: the footprint and the box share any ground at all.
 *
 * Three ways that happens, and all three are needed. An edge meets the box —
 * which also covers a footprint lying wholly inside it. A single-point
 * footprint, which has no edge, falls inside the box. Or a closed footprint
 * swallows the box whole, the case of a drag made inside a large room, where
 * nothing crosses anything.
 */
const doesFootprintMeetBox = (footprint: Footprint, box: BoundingBox): boolean => {
  const edges = edgesOf(footprint);

  if (edges.length === 0) {
    return footprint.points.some((point) => isPointInBox(point, box));
  }

  if (edges.some((edge) => doesSegmentMeetBox(edge, box))) {
    return true;
  }

  return footprint.closed && isPointInOutline(box.min, footprint.points);
};

/* -------------------------------------------------------------------------- */
/* Operations.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The ids a drag catches, in the order the floor holds them.
 *
 * Only the floor being viewed is walked, so an object on another floor is never
 * even a candidate; `isSelectable` then drops hidden and locked layers.
 */
export const marqueeHits = (marquee: Marquee, context: SelectionContext): EntityId[] => {
  const box = marqueeBox(marquee);
  const mode = marqueeMode(marquee);
  const hits: EntityId[] = [];

  for (const id of idsOnLevel(context.spatial, context.activeLevelId)) {
    if (!isSelectable(id, context)) {
      continue;
    }

    const entity = context.spatial.byId[id];

    if (entity === undefined) {
      continue;
    }

    const footprint = footprintOf(entity, context.spatial.byId);

    if (footprint === null) {
      continue;
    }

    const caught =
      mode === 'window'
        ? isFootprintEnclosed(footprint, box)
        : doesFootprintMeetBox(footprint, box);

    if (caught) {
      hits.push(id);
    }
  }

  return hits;
};

/**
 * What releasing the drag leaves selected.
 *
 * `combine` is what the modifier keys asked for: a plain drag replaces, Ctrl
 * adds, and a subtracting drag removes.
 */
export const applyMarquee = (
  selection: Selection,
  marquee: Marquee,
  combine: SelectionCombine,
  context: SelectionContext,
): Selection => combineSelection(selection, marqueeHits(marquee, context), combine, context);
