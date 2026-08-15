/**
 * Three drawings of the same storey, and the distances at which each is honest.
 *
 * A door leaf is 40 mm thick. At twenty metres it is worth drawing; at eighty it
 * is smaller than the pixel it lands in, and every triangle spent on it is spent
 * making a screen look exactly the same as it would have looked without them.
 * Level of detail is the arithmetic of that observation: draw the detail while it
 * is still visible, and stop when it is not.
 *
 * Three rungs, and each drops the class of detail that has just stopped
 * resolving:
 *
 * - **full** — everything `buildFloorMesh` makes. Walls with their openings cut,
 *   floor slabs, ceilings, and a panel hung in every door and window.
 * - **reduced** — the same building without the small parts hung *inside* it: the
 *   leaves and the glazing go, the holes they sat in stay. This is the rung that
 *   matters most, because the panels are the numerous ones: a storey has more
 *   openings than it has rooms.
 * - **block** — the massing. Walls are solid, the openings are not cut at all,
 *   ceilings are gone and the floor slabs are what is left. At sixty metres a
 *   building reads as a shape, and this rung draws the shape.
 *
 * The thresholds are **25 m** and **60 m**, measured in scene units, which are
 * metres — see `scene.ts`. A distance exactly on a threshold belongs to the
 * coarser rung: the number is where the cheaper drawing *starts*, which is also
 * the convention `THREE.LOD` uses, so `detailLevelAt` and `buildFloorLod` never
 * disagree about a boundary.
 *
 * Both entry points are pure with respect to the input: the model description is
 * never written to, and each rung is built from a fresh copy of it.
 */

import { LOD, type Group, type Object3D } from 'three';

import { readPartData, type BuildPartKind } from './scene';
import { buildFloorMesh, type BuildFloorInput } from './floor';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** How much of a storey is worth drawing. */
export type DetailLevel = 'full' | 'reduced' | 'block';

/** Every rung, from the richest to the cheapest. */
export const DETAIL_LEVELS: readonly DetailLevel[] = ['full', 'reduced', 'block'];

/** From here out, the leaves and the glazing stop being drawn. */
export const REDUCED_DISTANCE_M = 25;

/** From here out, only the massing is drawn. */
export const BLOCK_DISTANCE_M = 60;

/** The distance each rung takes over at, in the order `DETAIL_LEVELS` lists them. */
export const DETAIL_DISTANCES_M: Readonly<Record<DetailLevel, number>> = {
  full: 0,
  reduced: REDUCED_DISTANCE_M,
  block: BLOCK_DISTANCE_M,
};

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** What each rung drops, relative to everything `buildFloorMesh` builds. */
const DROPPED_KINDS: Readonly<Record<DetailLevel, readonly BuildPartKind[]>> = {
  full: [],
  reduced: ['opening'],
  block: ['opening', 'ceiling'],
};

/**
 * Take the named kinds out of a storey group.
 *
 * The group was built by this module, so removing from it writes to nothing the
 * caller owns. Building the whole storey and then dropping part of it costs a few
 * geometries that are never uploaded, and buys the one thing that matters more:
 * every rung is assembled by `buildFloorMesh` and only by `buildFloorMesh`, so no
 * rung can drift away from the shape the full one has.
 */
function withoutKinds(group: Group, dropped: readonly BuildPartKind[]): Group {
  if (dropped.length === 0) {
    return group;
  }

  const unwanted = new Set<BuildPartKind>(dropped);

  for (const child of [...group.children]) {
    const data = readPartData(child);
    if (data !== null && unwanted.has(data.kind)) {
      group.remove(child);
    }
  }

  return group;
}

/** Mark a group with the rung it is, without disturbing what tagged it. */
function tagDetail(group: Group, detail: DetailLevel): Group {
  group.userData = { ...group.userData, detail };
  return group;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Which rung a storey that far away should be drawn at.
 *
 * A distance exactly on a threshold has already crossed it: 25 m is `reduced`,
 * not `full`. Stating it one way round and testing it stops the boundary from
 * being argued about later.
 *
 * @throws RangeError when the distance is not a finite, non-negative length. A
 * camera that reports `NaN` is a bug, and quietly drawing the cheapest rung would
 * hide it behind a building that merely looks far away.
 */
export function detailLevelAt(distanceM: number): DetailLevel {
  if (!Number.isFinite(distanceM) || distanceM < 0) {
    throw new RangeError(`Distance must be a finite, non-negative length: ${String(distanceM)}`);
  }

  if (distanceM < REDUCED_DISTANCE_M) {
    return 'full';
  }
  if (distanceM < BLOCK_DISTANCE_M) {
    return 'reduced';
  }
  return 'block';
}

/** The rung a group was built at, or `null` when it was not built by this module. */
export function readDetail(object: Object3D): DetailLevel | null {
  const detail: unknown = (object.userData as Record<string, unknown>).detail;
  return typeof detail === 'string' && (DETAIL_LEVELS as readonly string[]).includes(detail)
    ? (detail as DetailLevel)
    : null;
}

/**
 * One storey, built at one rung.
 *
 * The group is the one `buildFloorMesh` returns — named after the level, every
 * mesh carrying the model id it came from — so batching, picking and highlighting
 * work the same at every rung. `userData.detail` says which rung it is.
 *
 * At `block` the walls are built with no openings at all rather than with their
 * holes filled in afterwards: a solid wall is the cheaper geometry as well as the
 * simpler description.
 */
export function buildFloorAtDetail(input: BuildFloorInput, detail: DetailLevel): Group {
  const model = detail === 'block' ? { ...input, openings: [] } : input;
  return tagDetail(withoutKinds(buildFloorMesh(model), DROPPED_KINDS[detail]), detail);
}

/**
 * All three rungs, ready for three.js to swap between as the camera moves.
 *
 * `THREE.LOD` picks by distance from the camera in world units, which are the
 * metres this package works in, and it treats a level's distance as the point the
 * level *starts* — the same convention `detailLevelAt` states. So the two agree
 * at 25 m and at 60 m without either having to know about the other.
 */
export function buildFloorLod(input: BuildFloorInput): LOD {
  const lod = new LOD();

  for (const detail of DETAIL_LEVELS) {
    lod.addLevel(buildFloorAtDetail(input, detail), DETAIL_DISTANCES_M[detail]);
  }

  lod.name = input.level.id;
  return lod;
}
