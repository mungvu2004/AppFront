/**
 * The boundary between the plan and the scene.
 *
 * Everything upstream of this file — the whole of `src/domain` — measures in
 * millimetres. Everything downstream of it is a three.js scene, and a scene
 * measures in **metres**: cameras, lights, near/far planes and shadow bias are
 * all tuned for numbers of that size, and a building modelled at 4000 units wide
 * looks correct right up until the first shadow map or the first orbit control.
 *
 * So the conversion happens **once**, here, in `toSceneLength`. No other
 * function in `src/lib/three/build` divides by a thousand, and none of them may
 * start to: every length that reaches a `Vector2` or a `Vector3` goes through
 * one of the constructors below, which is what makes the unit story checkable by
 * reading a single function rather than auditing every expression that touches a
 * coordinate.
 *
 * The second thing this file fixes is the **plan-to-scene axes**. A plan is
 * `(x, y)` on the floor; a scene has `y` pointing up. This module maps
 * `plan.x → scene.x`, `plan.y → scene.z`, and elevation above the project datum
 * → `scene.y`. Walls, slabs and ceilings all sit in that one frame, so a mesh
 * from one builder lines up with a mesh from another without anybody having to
 * remember a sign.
 *
 * The third is **traceability**. A generated scene has no meaning on its own: a
 * person who clicks a surface is asking "which wall is this?", and the answer
 * has to come back as a model id, not as a mesh index. Every object this package
 * builds therefore carries a `PartUserData` in `userData`, and `tagPart` is the
 * only way one is attached, so no builder can forget.
 */

import { Vector2, Vector3, type Object3D } from 'three';

import type { PointMm } from '@/domain/units/compare';
import { millimetresToMetres, type Millimetres } from '@/domain/units/types';
import type { LevelId, OpeningId, RoomId, WallId } from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* Units.                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A length in scene units.
 *
 * Scene units are metres. The alias exists so a signature can say which side of
 * the boundary it is on: a `Millimetres` argument is model data, a `SceneLength`
 * is already converted and must not be converted again.
 */
export type SceneLength = number;

/**
 * Millimetres to scene units. The only conversion in this package.
 *
 * @throws RangeError when the value is not a finite length.
 */
export function toSceneLength(valueMm: Millimetres): SceneLength {
  return millimetresToMetres(valueMm);
}

/** A pair of model lengths as a scene-space 2D point. */
export function sceneVector2(firstMm: Millimetres, secondMm: Millimetres): Vector2 {
  return new Vector2(toSceneLength(firstMm), toSceneLength(secondMm));
}

/**
 * A plan coordinate and an elevation as a scene-space 3D point.
 *
 * `plan.x → x`, elevation → `y`, `plan.y → z`. Every builder in this package
 * places its geometry through this function or through the wall frame that is
 * built on top of it, so the axes are declared in exactly one place.
 */
export function scenePoint(point: PointMm, elevationMm: Millimetres): Vector3 {
  return new Vector3(
    toSceneLength(point.x),
    toSceneLength(elevationMm),
    toSceneLength(point.y),
  );
}

/* -------------------------------------------------------------------------- */
/* Tracing a mesh back to the model.                                           */
/* -------------------------------------------------------------------------- */

/** What a built object stands for. */
export type BuildPartKind = 'level' | 'wall' | 'floorSlab' | 'ceiling' | 'opening';

/** The model ids a built object can point back at. */
export type BuildEntityId = LevelId | WallId | RoomId | OpeningId;

/**
 * The tag every built object carries.
 *
 * `entityId` is the whole point: it is the prefixed model id — `W-12`, `R-04`,
 * `D-7` — so a hit test hands the interface something it can look up, select and
 * write a `commit()` against. `levelId` rides along because a scene holds several
 * storeys at once and a wall id alone does not say which one was clicked.
 */
export interface PartUserData {
  readonly kind: BuildPartKind;
  readonly entityId: BuildEntityId;
  readonly levelId: LevelId;
}

/**
 * Attach the tag, and name the object after the entity it stands for.
 *
 * The name is set as well as the tag so `group.getObjectByName('W-12')` finds
 * the wall — three's own lookup is by name, and a scene whose names are
 * `Mesh_17` is one nobody can debug.
 */
export function tagPart<TObject extends Object3D>(object: TObject, data: PartUserData): TObject {
  object.name = data.entityId;
  object.userData = { ...data };
  return object;
}

/** Is this `userData` one of ours? */
function hasPartShape(value: unknown): value is PartUserData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<Record<keyof PartUserData, unknown>>;
  return (
    typeof candidate.kind === 'string' &&
    typeof candidate.entityId === 'string' &&
    typeof candidate.levelId === 'string'
  );
}

/**
 * The model entity behind an object, or `null` when it is not one of ours.
 *
 * `userData` is typed `any` by three, so this is the gate that turns it back
 * into something the compiler will check. A caller that has just picked a mesh
 * out of a raycast uses this rather than reading the field directly.
 */
export function readPartData(object: Object3D): PartUserData | null {
  return hasPartShape(object.userData) ? object.userData : null;
}
