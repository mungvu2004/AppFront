/**
 * Turning a wall centreline into a solid, with its doors and windows cut out.
 *
 * A wall is stored as a line and a thickness (`domain/walls/types.ts`), and a
 * hole is stored as a fraction along that line (`domain/openings/types.ts`).
 * Neither is a shape. This module is where they become one, and it does it by
 * **generating** the geometry every time rather than by placing a library model:
 * a 3,4 m partition with a 900 mm door 600 mm from the corner is not a catalogue
 * item, it is arithmetic.
 *
 * The method is an extruded elevation. The wall is drawn flat, in its own frame —
 * `u` running along the centreline from the `start` end, `v` running up from the
 * wall base — the openings are cut out of that flat drawing, and the result is
 * extruded sideways by the wall thickness. One `ExtrudeGeometry` call, no CSG
 * library, no boolean solver: a hole in a wall is a hole in a `Shape`, which is
 * what `THREE.Shape.holes` is for.
 *
 * That choice decides how each opening is cut, because a `Shape` hole must not
 * touch the outline it is cut from — the two contours would share an edge and the
 * triangulator has no answer for that. So an opening is cut one of three ways
 * depending on where it sits, and the difference is geometric, not a matter of
 * taste:
 *
 * - A **window** floats clear of the base and the top: a true hole.
 * - A **door** stands on the base: not a hole but a notch, cut into the outline
 *   itself, so the outline walks up one jamb, across the head and down the other.
 * - A **full-height opening** — an archway that reaches base and top — is not a
 *   hole at all. It divides the wall into two panels that are extruded together
 *   into one geometry.
 *
 * Openings that cannot be cut are **reported, never repaired**. A window whose
 * head is above the top of its wall, a door that runs past the corner, two
 * openings in the same place: each comes back in `userData.refusals` with a
 * Vietnamese sentence, and the wall is built without it. Silently shrinking the
 * opening to fit would build a model that disagrees with the drawing somebody
 * measured, which is the failure this codebase exists to catch.
 *
 * **Which** openings are cut that way, and where the outline has to step, is not
 * decided here: it comes from `plan.ts`, which knows nothing about three.js. The
 * worker in `build.worker.ts` builds the same walls from the same plan with its
 * own triangles, and the split is what makes the two agree by construction
 * instead of by inspection. This file owns one thing — turning a plan into a
 * `THREE.Mesh`.
 *
 * Every length here is millimetres until it reaches `scene.ts`. See that file for
 * why the conversion happens exactly once and where the axes come from.
 */

import { ExtrudeGeometry, Matrix4, Mesh, Path, Shape, Vector3 } from 'three';

import { millimetres, type Millimetres } from '@/domain/units/types';
import type { Opening } from '@/domain/openings/types';
import { assertUsableWall, centrelineLength, type Wall } from '@/domain/walls/types';
import type { LevelId, OpeningId, WallId } from '@/domain/spatial/types';

import {
  openingsOnWall,
  panelHoles,
  panelOutline,
  planCuts,
  planPanels,
  type CutRefusal,
  type OpeningCut,
  type Panel,
} from './plan';
import { sceneVector2, tagPart, toSceneLength, type PartUserData } from './scene';

export type { CutRefusal, CutRefusalReason } from './plan';

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a wall mesh points back at.
 *
 * `openingIds` lists the openings that were really cut, so a caller can tell a
 * wall drawn with its door from one drawn without it, and `refusals` says what
 * went missing and why rather than leaving a person to notice the door is gone.
 */
export interface WallPartData extends PartUserData {
  readonly kind: 'wall';
  readonly entityId: WallId;
  readonly openingIds: readonly OpeningId[];
  readonly refusals: readonly CutRefusal[];
}

/** What `buildWallMesh` needs beyond the wall itself. */
export interface BuildWallOptions {
  /** The storey the wall is drawn on; travels into `userData`. */
  readonly levelId: LevelId;
  /**
   * Openings to cut. Anything attached to another wall, and every orphan, is
   * ignored — a caller may pass the whole plan's list.
   */
  readonly openings?: readonly Opening[];
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** A rectangular hole, wound the opposite way round from the outline. */
function holePath(cut: OpeningCut): Path {
  return new Path([
    sceneVector2(cut.lowMm, cut.sillMm),
    sceneVector2(cut.lowMm, cut.headMm),
    sceneVector2(cut.highMm, cut.headMm),
    sceneVector2(cut.highMm, cut.sillMm),
  ]);
}

/** One panel as a flat shape: outline counter-clockwise, holes inside it. */
function panelShape(panel: Panel, heightMm: Millimetres): Shape {
  const shape = new Shape(
    panelOutline(panel, heightMm).map((corner) => sceneVector2(corner.alongMm, corner.heightMm)),
  );

  for (const hole of panelHoles(panel)) {
    shape.holes.push(holePath(hole));
  }

  return shape;
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The frame a wall's own coordinates live in, ready to be applied to geometry.
 *
 * Local `x` runs along the centreline from the `start` end, local `y` is up, and
 * local `z` crosses the wall — so a point at `(u, v, 0)` sits on the centreline
 * `u` along and `v` above the base, whatever direction the wall was drawn in.
 * `buildWallMesh` uses it for the wall body; `floor.ts` uses it to hang door
 * leaves and glazing in the holes without repeating the trigonometry.
 *
 * @throws RangeError when the wall is not one the geometry can work with.
 */
export function wallFrame(wall: Wall): Matrix4 {
  assertUsableWall(wall);

  const { start, end } = wall.centreline;
  const lengthMm = centrelineLength(wall);
  const alongX = (end.x - start.x) / lengthMm;
  const alongY = (end.y - start.y) / lengthMm;

  return new Matrix4()
    .makeBasis(
      new Vector3(alongX, 0, alongY),
      new Vector3(0, 1, 0),
      new Vector3(-alongY, 0, alongX),
    )
    .setPosition(
      toSceneLength(start.x),
      toSceneLength(wall.baseElevationMm),
      toSceneLength(start.y),
    );
}

/**
 * Extrude a wall centreline into a solid, cutting its doors and windows out.
 *
 * The mesh is centred on the centreline — half the thickness each side — and runs
 * from `baseElevationMm` to `topElevationMm`, both measured from the project
 * datum, so a parapet and the wall below it stack without either knowing about
 * the other.
 *
 * Its `userData` is a `WallPartData`: the wall id to trace back to, the openings
 * that were cut, and the ones that were refused. Reading it through
 * `readPartData` is what turns a raycast hit into something the interface can
 * select.
 *
 * No material is assigned. Colour is a token decision and belongs to the caller,
 * not to a geometry builder.
 *
 * @throws RangeError when the thickness is outside 60–600 mm, the centreline has
 * no length, or the top is not above the base.
 */
export function buildWallMesh(wall: Wall, options: BuildWallOptions): Mesh {
  const frame = wallFrame(wall);
  const lengthMm = centrelineLength(wall);
  const heightMm = millimetres(wall.topElevationMm - wall.baseElevationMm);

  const { cuts, refusals } = planCuts(
    wall,
    openingsOnWall(wall, options.openings ?? []),
    lengthMm,
    heightMm,
  );

  const shapes = planPanels(cuts, lengthMm).map((panel) => panelShape(panel, heightMm));
  const geometry = new ExtrudeGeometry(shapes, {
    depth: toSceneLength(wall.thicknessMm),
    bevelEnabled: false,
    steps: 1,
  });

  // The extrusion grows along local +z from the centreline; sliding it back by
  // half the thickness is what makes the centreline the *centre* line.
  geometry.translate(0, 0, -toSceneLength(millimetres(wall.thicknessMm / 2)));
  geometry.applyMatrix4(frame);

  // A wall swallowed whole by a full-height opening has no panels left, and
  // asking an empty geometry for its bounds only produces a NaN radius.
  if (shapes.length > 0) {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  const data: WallPartData = {
    kind: 'wall',
    entityId: wall.id,
    levelId: options.levelId,
    openingIds: cuts.map((cut) => cut.openingId),
    refusals,
  };

  return tagPart(new Mesh(geometry), data);
}
