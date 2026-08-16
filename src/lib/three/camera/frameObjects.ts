/**
 * Where to stand so that a chosen thing fills the screen, and no further in.
 *
 * A reviewer selects three walls and asks to see them. That is two separate
 * questions, and this file keeps them apart because only one of them is
 * arithmetic:
 *
 * - **Which box are those three walls?** A scene read — it depends on what has
 *   been built, where it sits and what tag each mesh carries. {@link boundsOfIds}
 *   answers it, and it is the only function here that touches an `Object3D`.
 * - **Given a box, where does the camera go?** Pure geometry on eight corners and
 *   a field of view. {@link frameViewpoint}, {@link unionBounds},
 *   {@link boxOfExtent} and {@link boxExitDistance} answer it, and none of them
 *   reads a scene, a store or a clock, allocates into anything the caller owns,
 *   or returns a different answer the second time it is asked.
 *
 * That split is what makes the framing testable at all: a test states a box and a
 * viewport and checks the eight corners land inside the frustum, with no renderer
 * and no model.
 *
 * ## The two guarantees
 *
 * **Fifteen per cent stays empty.** The distance is chosen so the widest and
 * tallest the box ever projects is `1 − paddingFraction` of the viewport — stated
 * against the *near* corner of the box, not its centre plane, so nothing pokes
 * out of the frame because it happened to be the corner closest to the camera.
 * A test can therefore assert one number: no corner projects past 0,85 in
 * normalised device coordinates.
 *
 * **The camera never ends up inside a solid.** Fitting a box says how far away
 * the camera must be to *see* it, and for a long thin box seen end-on that
 * distance can be well inside the box itself. {@link boxExitDistance} answers the
 * separate question — how far along this ray is the box finally behind me — by
 * the ordinary slab intersection, and the distance actually used is whichever of
 * the two is larger, plus a margin. A camera that frames a corridor from its own
 * axis is pushed out past the end of it rather than parked in the middle of a
 * wall.
 *
 * ## Conventions
 *
 * Metres, and the spherical frame `modes.ts` documents. The view basis is built
 * with three's own `setFromSphericalCoords`, which is the very call `eyeOffset`
 * makes, so the sign convention is not written down twice and cannot drift.
 */

import { Box3, Vector3, type Object3D } from 'three';

import { degrees, degreesToRadians, RADIANS_PER_TURN } from '@/domain/units/types';

import { readPartData } from '../build/scene';
import { CAMERA_SETTINGS } from './settings';
import type { BuildingExtent, Viewpoint } from './modes';

const QUARTER_TURN_RAD = RADIANS_PER_TURN / 4;

const HALF_FIELD_OF_VIEW_RAD = degreesToRadians(
  degrees(CAMERA_SETTINGS.shared.fieldOfViewDeg / 2),
);

/** Below this a direction component counts as parallel to a slab. */
const PARALLEL_EPSILON = 1e-12;

/* -------------------------------------------------------------------------- */
/* Public types.                                                               */
/* -------------------------------------------------------------------------- */

/** The camera's own axes at a heading and a vertical angle. */
export interface ViewBasis {
  /** Eye towards target. */
  readonly forward: Vector3;
  /** Screen right; always horizontal. */
  readonly right: Vector3;
  /** Screen up; stands on the plan when the view is straight down. */
  readonly up: Vector3;
}

/** Everything {@link frameViewpoint} needs beyond the box itself. */
export interface FrameOptions {
  /** Heading to look from — normally the one already in use. */
  readonly azimuthRad: number;
  /** Vertical angle to look from. */
  readonly polarRad: number;
  /** Viewport width over height. A wide box is framed by width as well as height. */
  readonly aspect: number;
  /** How much of the viewport is left empty around the box. 0,15 is fifteen per cent. */
  readonly paddingFraction: number;
  /** How far clear of a solid the eye must sit, in metres. */
  readonly clearanceMarginM: number;
  /** A further solid the eye must stay out of — the building, when framing part of it. */
  readonly avoid?: Box3;
  /**
   * Frame for an orthographic camera rather than a perspective one.
   *
   * Under a perspective camera the near corner of a box subtends more angle than
   * its far one, so the fit has to allow for the box's depth. An orthographic
   * camera has no such effect — depth changes nothing about size — and allowing
   * for it anyway would leave a deep box floating in the middle of a frame it was
   * asked to fill. The distance is still held clear of the solids either way.
   */
  readonly orthographic?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pure geometry.                                                              */
/* -------------------------------------------------------------------------- */

/** The box a building extent describes. Pure. */
export function boxOfExtent(extent: BuildingExtent): Box3 {
  const half = extent.sizeM.clone().multiplyScalar(0.5);
  return new Box3(extent.centre.clone().sub(half), extent.centre.clone().add(half));
}

/**
 * The smallest box containing all of them, or `null` when there are none. Pure.
 *
 * Empty boxes are skipped rather than unioned: three marks an empty box with
 * `min = +∞, max = −∞`, and folding one of those in would swallow everything
 * else.
 */
export function unionBounds(boxes: readonly Box3[]): Box3 | null {
  let union: Box3 | null = null;

  for (const box of boxes) {
    if (box.isEmpty()) {
      continue;
    }
    if (union === null) {
      union = box.clone();
    } else {
      union.union(box);
    }
  }

  return union;
}

/**
 * The camera's axes at this heading and vertical angle. Pure.
 *
 * `forward` is the negative of the eye offset `modes.ts` builds, taken from the
 * same `setFromSphericalCoords` call, and `right` is that call again a quarter
 * turn round the horizon. `up` is then `right × forward`, which is an identity
 * rather than a convention — so nothing about the axis signs is restated here
 * and nothing can drift away from the modes.
 */
export function viewBasis(azimuthRad: number, polarRad: number): ViewBasis {
  const forward = new Vector3().setFromSphericalCoords(1, polarRad, azimuthRad).negate();
  const right = new Vector3().setFromSphericalCoords(
    1,
    QUARTER_TURN_RAD,
    azimuthRad + QUARTER_TURN_RAD,
  );
  return { forward, right, up: new Vector3().crossVectors(right, forward) };
}

/**
 * How far along the ray the box is finally behind you, in metres. Pure.
 *
 * The ordinary slab intersection, reported as its far root. Zero when the ray
 * never meets the box at all — including the case of an origin already outside
 * and pointing away — so a caller can always take it as "the least distance at
 * which I am certainly clear of this solid".
 */
export function boxExitDistance(box: Box3, origin: Vector3, direction: Vector3): number {
  let nearest = -Infinity;
  let furthest = Infinity;

  const slab = (originA: number, directionA: number, minA: number, maxA: number): boolean => {
    if (Math.abs(directionA) < PARALLEL_EPSILON) {
      // Parallel to this pair of faces: either always between them, or never.
      return originA >= minA && originA <= maxA;
    }
    const first = (minA - originA) / directionA;
    const second = (maxA - originA) / directionA;
    nearest = Math.max(nearest, Math.min(first, second));
    furthest = Math.min(furthest, Math.max(first, second));
    return true;
  };

  const meets =
    slab(origin.x, direction.x, box.min.x, box.max.x) &&
    slab(origin.y, direction.y, box.min.y, box.max.y) &&
    slab(origin.z, direction.z, box.min.z, box.max.z);

  if (!meets || nearest > furthest || !Number.isFinite(furthest)) {
    return 0;
  }
  return Math.max(0, furthest);
}

/**
 * Where to stand to see the whole of a box, with the padding left empty. Pure.
 *
 * The eight corners are measured against the camera's own axes, so a box seen
 * along its diagonal is framed by what it actually covers rather than by its
 * width in world axes. The half-depth is added to the fitted distance because
 * the corner nearest the camera is the one that overflows first: without it, a
 * deep box fits on paper and spills off the screen.
 *
 * The result is then held clear of the box itself — and of `avoid`, if one is
 * given — so the camera is never left standing inside what it is looking at.
 */
export function frameViewpoint(box: Box3, options: FrameOptions): Viewpoint {
  const basis = viewBasis(options.azimuthRad, options.polarRad);
  const centre = box.getCenter(new Vector3());

  let halfWidthM = 0;
  let halfHeightM = 0;
  let halfDepthM = 0;
  const offset = new Vector3();

  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        offset.set(x, y, z).sub(centre);
        halfWidthM = Math.max(halfWidthM, Math.abs(offset.dot(basis.right)));
        halfHeightM = Math.max(halfHeightM, Math.abs(offset.dot(basis.up)));
        halfDepthM = Math.max(halfDepthM, Math.abs(offset.dot(basis.forward)));
      }
    }
  }

  const usable = Math.max(1e-6, 1 - options.paddingFraction);
  const halfTanY = Math.tan(HALF_FIELD_OF_VIEW_RAD);
  const halfTanX = halfTanY * (Number.isFinite(options.aspect) && options.aspect > 0
    ? options.aspect
    : 1);

  const subtended = Math.max(halfHeightM / (usable * halfTanY), halfWidthM / (usable * halfTanX));
  const fitted = options.orthographic === true ? subtended : subtended + halfDepthM;

  // Under an orthographic camera how far you stand is not how big things look,
  // so the two questions come apart. Standing clear is then the flat modes' own
  // job — they park outside the bounding sphere — and folding it in here would
  // be folding it into the zoom instead: an 83 m building seen end-on would have
  // to be viewed from 42 m away, and the drawing would come back half the size
  // it was asked for. Only a perspective camera, where the standing distance is
  // the framing distance, has to satisfy both at once.
  if (options.orthographic === true) {
    return {
      target: centre,
      azimuthRad: options.azimuthRad,
      polarRad: options.polarRad,
      distanceM: fitted,
    };
  }

  // The eye looks along `forward`, so it stands along the opposite ray.
  const outward = basis.forward.clone().negate();
  let clearM = boxExitDistance(box, centre, outward);
  if (options.avoid !== undefined) {
    clearM = Math.max(clearM, boxExitDistance(options.avoid, centre, outward));
  }

  return {
    target: centre,
    azimuthRad: options.azimuthRad,
    polarRad: options.polarRad,
    distanceM: Math.max(fitted, clearM + options.clearanceMarginM),
  };
}

/* -------------------------------------------------------------------------- */
/* Reading the scene.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The box around every tagged object carrying one of these ids.
 *
 * The one function here that is not pure, and the reason the rest can be: it
 * walks an `Object3D`, and `Box3.setFromObject` refreshes world matrices and
 * fills in geometry bounding boxes as it goes — three's own caches, written
 * where three would have written them.
 *
 * Matching is by `entityId` from `build/scene.ts`, so a caller passes the model
 * ids it already has — `W-12`, `R-04` — and never a mesh or an index. Ids that
 * match nothing are ignored; all of them matching nothing gives `null`, which is
 * a selection there is no sensible camera move for.
 */
export function boundsOfIds(root: Object3D, ids: Iterable<string>): Box3 | null {
  const wanted = new Set(ids);
  if (wanted.size === 0) {
    return null;
  }

  const boxes: Box3[] = [];
  root.traverse((object) => {
    const data = readPartData(object);
    if (data !== null && wanted.has(data.entityId)) {
      boxes.push(new Box3().setFromObject(object));
    }
  });

  return unionBounds(boxes);
}

/**
 * Frame the objects with these ids: the whole job, in one call.
 *
 * `null` when nothing in the scene carries one of the ids — the caller should
 * leave the camera alone rather than fly it to the origin.
 */
export function frameObjects(
  root: Object3D,
  ids: Iterable<string>,
  options: FrameOptions,
): Viewpoint | null {
  const box = boundsOfIds(root, ids);
  return box === null ? null : frameViewpoint(box, options);
}
