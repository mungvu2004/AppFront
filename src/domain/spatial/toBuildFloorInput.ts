/**
 * One storey of the spatial graph, in the vocabulary the geometry builder reads.
 *
 * The graph and the geometry describe the same building with two different sets
 * of words, and the differences between them are not renames: a wall carries a
 * height in one and two absolute elevations in the other, a coordinate is a bare
 * number in one and a labelled millimetre in the other, and the two `Wall` types
 * do not even agree on what kinds of wall exist. Crossing that boundary is a set
 * of decisions, and **none of them is made here for the first time**:
 * `src/lib/commands/business/shared.ts` already crossed it for the command
 * layer, and every choice below is the one it made. A viewer and a command that
 * disagreed about where a wall starts would be two buildings.
 *
 * ## The three crossings that are not field renames
 *
 * 1. **A height above the floor becomes two elevations above the datum.** The
 *    graph stores `heightMm` on the wall and says nothing about where the wall
 *    begins vertically; `@/domain/walls` stores `baseElevationMm` and
 *    `topElevationMm`, both measured from the project datum. A wall therefore
 *    starts at the **finished floor** of the level it stands on — `elevationMm`
 *    is that line (`@/lib/three/build/floor`'s own header says so) — and ends
 *    `heightMm` above it. That is `toSolidWall`
 *    (`src/lib/commands/business/shared.ts:314-316`) and it is what the
 *    presentation layer's JSON converter writes too
 *    (`src/lib/three/present/plan.ts:172-173`). A parapet that starts half way
 *    up a storey cannot be expressed in the graph at all, so nothing is lost by
 *    assuming it does not.
 *
 * 2. **`envelope` has no name in the wall domain, so it takes `glazed`.** The
 *    graph knows `loadBearing | partition | envelope`; the wall domain knows
 *    `loadBearing | partition | railing | glazed`. {@link SOLID_WALL_KIND} is
 *    the map `src/lib/commands/business/shared.ts:291-295` chose, and it is
 *    chosen for one property: it is **one to one**, so two walls share a
 *    geometry kind exactly when they share a graph kind. Nothing in
 *    `@/lib/three/build` reads a wall's kind at all — `buildWallMesh` and
 *    `buildFloorMesh` extrude from the centreline, the thickness and the two
 *    elevations — so this choice cannot move a millimetre of geometry; it only
 *    has to stay reversible. `railing` and `glazed` are never produced from a
 *    graph that does not have them, which is the same statement read the other
 *    way round.
 *
 * 3. **Openings leave the wall and become a list of their own.** The graph hangs
 *    `openingIds` on each wall and stores an offset from the start of the
 *    centreline to the opening's **left edge**;
 *    {@link import('../openings/types').AttachedOpening} stores the fraction of
 *    the way along to its **centre**, and `BuildFloorInput` takes every opening
 *    on the storey as one array beside the walls rather than nested inside them.
 *    The arithmetic is `relativePositionOf`
 *    (`src/lib/commands/business/shared.ts:335-336`); `sillHeightMm` passes
 *    straight through (`shared.ts:346`) because the graph measures it from the
 *    level floor and the openings domain measures it from the base of the host
 *    wall — and crossing 1 above made those the same line. The graph's
 *    `kind` (`door | window`) is a subset of the openings domain's
 *    (`door | window | void`), so `void` is a shape this converter never
 *    produces; neither is an `OrphanOpening`, because a graph opening always
 *    names its wall. The review metadata every graph entity carries —
 *    `confidence`, `source`, `reviewed` — has no home in the geometry and is
 *    dropped: a mesh is not the place a person approves a detection.
 *
 * ## What a broken storey does
 *
 * Two different failures, told apart the way `./normalize` already tells them
 * apart:
 *
 * - **`null` means there is no such storey.** An unknown `levelId` is a question
 *   about which storey to build, and "there is not one" is an answer a screen
 *   can show as an empty state. `idsOnLevel` (`./normalize`) returns an empty
 *   list for the same case.
 * - **A throw means the storey cannot be measured.** A dangling index entry
 *   throws an `Error` the way `denormalizeSpatial` does; a measurement that is
 *   not a finite number throws the `RangeError` that `millimetres()` throws at
 *   the units boundary. Nothing is repaired and nothing is clamped, because a
 *   wall silently placed at 0 mm is a drawing that measures differently from the
 *   one the surveyor signed.
 *
 * `BuildFloorInput` is imported as a **type only**, so no part of three.js
 * reaches the domain at runtime; this module is pure and has no React, no store
 * and no network, like the rest of `src/domain`.
 */

import type { BuildFloorInput, BuildableLevel, BuildableRoom } from '../../lib/three/build/floor';
import { clampRelativePosition, type AttachedOpening } from '../openings/types';
import { isNearlyZero, type PointMm } from '../units/compare';
import { millimetres } from '../units/types';
import { centrelineLength, type Wall as SolidWall, type WallKind as SolidWallKind } from '../walls/types';

import { idsOnLevel, isEntityOfKind, type NormalizedSpatial } from './normalize';
import type {
  Level,
  LevelId,
  Opening as GraphOpening,
  Point,
  Room,
  Wall as GraphWall,
  WallId,
  WallKind as GraphWallKind,
} from './types';

/* -------------------------------------------------------------------------- */
/* The vocabulary map.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The geometry kind each graph kind becomes.
 *
 * A complete record rather than a lookup with a fallback, so a fourth graph kind
 * fails the build here instead of quietly arriving on screen as a partition.
 * See crossing 2 in the header for why `envelope` lands on `glazed`.
 */
const SOLID_WALL_KIND: Readonly<Record<GraphWallKind, SolidWallKind>> = {
  loadBearing: 'loadBearing',
  partition: 'partition',
  envelope: 'glazed',
};

/* -------------------------------------------------------------------------- */
/* The three entity crossings.                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A graph coordinate, labelled as millimetres.
 *
 * The graph's `Point` holds bare numbers and `PointMm` holds branded ones, so
 * this is where an untyped coordinate becomes a measurement — and, because
 * `millimetres()` is that gate, where a coordinate that is not a finite number
 * stops.
 *
 * @throws RangeError when either coordinate is not finite.
 */
function toPointMm(point: Point): PointMm {
  return { x: millimetres(point.x), y: millimetres(point.y) };
}

/**
 * A graph level as the builder wants it.
 *
 * The three fields already agree by name; only the brand differs.
 *
 * @throws RangeError when the elevation or the height is not finite.
 */
function toBuildableLevel(level: Level): BuildableLevel {
  return {
    id: level.id,
    elevationMm: millimetres(level.elevationMm),
    heightMm: millimetres(level.heightMm),
  };
}

/**
 * A graph room as the builder wants it.
 *
 * Everything else a room carries — its name, its usage, its area, the walls that
 * bound it — describes the room rather than its slab, and the slab is the whole
 * of what the builder makes from it.
 *
 * @throws RangeError when any corner is not a finite coordinate.
 */
function toBuildableRoom(room: Room): BuildableRoom {
  return { id: room.id, outline: room.outline.map(toPointMm) };
}

/**
 * A graph wall as the geometry functions want it.
 *
 * The level has to come with the wall because the graph stores a height above
 * the floor while the geometry works in absolute elevations — crossing 1 in the
 * header.
 *
 * @throws RangeError when a measurement on the wall or its level is not finite.
 */
function toSolidWall(wall: GraphWall, level: Level): SolidWall {
  return {
    id: wall.id,
    kind: SOLID_WALL_KIND[wall.kind],
    centreline: {
      start: toPointMm(wall.centreline.start),
      end: toPointMm(wall.centreline.end),
    },
    thicknessMm: millimetres(wall.thicknessMm),
    baseElevationMm: millimetres(level.elevationMm),
    topElevationMm: millimetres(level.elevationMm + wall.heightMm),
  };
}

/**
 * A graph opening as the openings domain wants it, placed along its host.
 *
 * The offset to the left edge becomes the fraction of the way along to the
 * centre — crossing 3 in the header.
 *
 * @throws RangeError when a measurement on the opening is not finite, or when
 * the host centreline has no length: a fraction of nothing is not a position,
 * and returning `NaN` would put the opening somewhere no one could see.
 */
function toAttachedOpening(opening: GraphOpening, wall: SolidWall): AttachedOpening {
  const widthMm = millimetres(opening.widthMm);
  const offsetMm = millimetres(opening.offsetMm);
  const lengthMm = centrelineLength(wall);

  if (isNearlyZero(lengthMm)) {
    throw new RangeError(
      `Opening ${opening.id} sits on wall ${wall.id}, whose centreline has zero length.`,
    );
  }

  return {
    id: opening.id,
    kind: opening.kind,
    widthMm,
    heightMm: millimetres(opening.heightMm),
    sillHeightMm: millimetres(opening.sillHeightMm),
    swing: opening.swing,
    wallId: wall.id,
    relativePosition: clampRelativePosition((offsetMm + widthMm / 2) / lengthMm),
  };
}

/* -------------------------------------------------------------------------- */
/* The storey.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Everything one storey of the graph is built from.
 *
 * Reads the level index rather than scanning: `byLevel` already holds the walls,
 * rooms and openings placed on the storey, an opening having inherited the level
 * of the wall it is cut into (`./normalize`). Walls are converted first because
 * an opening's position is a fraction of its host's centreline, so the host has
 * to exist as geometry before the opening can be placed on it — the index order
 * is not relied on.
 *
 * `openings` is always present, empty included, so a caller never has to tell
 * "this storey has no openings" from "this converter did not look".
 * `slabThicknessMm` is deliberately not set: the thickness is the builder's
 * decision (`SLAB_THICKNESS_MM`) and the graph has no opinion to override it
 * with.
 *
 * @returns `null` when no level of the graph carries this id.
 * @throws Error when the level index points at an entity that is not in `byId`,
 * or when an opening on the storey names a wall that is not on it.
 * @throws RangeError when any measurement on the storey is not a finite number,
 * or when an opening sits on a wall of zero length.
 */
export function toBuildFloorInput(
  spatial: NormalizedSpatial,
  levelId: LevelId,
): BuildFloorInput | null {
  const level = spatial.byId[levelId];

  if (level === undefined || !isEntityOfKind('level', level)) {
    return null;
  }

  const walls: SolidWall[] = [];
  const rooms: BuildableRoom[] = [];
  const graphOpenings: GraphOpening[] = [];
  const hostById = new Map<WallId, SolidWall>();

  for (const id of idsOnLevel(spatial, levelId)) {
    const entity = spatial.byId[id];

    if (entity === undefined) {
      throw new Error(`toBuildFloorInput: byLevel.${levelId} points at a missing entity ${id}`);
    }

    if (isEntityOfKind('wall', entity)) {
      const solid = toSolidWall(entity, level);

      walls.push(solid);
      hostById.set(solid.id, solid);
    } else if (isEntityOfKind('room', entity)) {
      rooms.push(toBuildableRoom(entity));
    } else if (isEntityOfKind('opening', entity)) {
      graphOpenings.push(entity);
    }
  }

  const openings = graphOpenings.map((opening) => {
    const host = hostById.get(opening.wallId);

    if (host === undefined) {
      throw new Error(
        `toBuildFloorInput: opening ${opening.id} names wall ${opening.wallId}, ` +
          `which is not on level ${levelId}`,
      );
    }

    return toAttachedOpening(opening, host);
  });

  return { level: toBuildableLevel(level), walls, rooms, openings };
}
