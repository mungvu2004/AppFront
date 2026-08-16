/**
 * Turning "the ray crossed these triangles" into "the pointer is over wall
 * W-12", in a scene whose walls no longer own a mesh each.
 *
 * `merge.ts` collapses forty-eight wall meshes into one buffer to save
 * forty-seven draw calls, and pays for it with the only question a QC screen
 * ever asks: *which* wall. The vertex range table it keeps alongside the buffer
 * is the answer, and this file is the walk from a raycast hit back to it.
 *
 * Nothing here shoots a ray. Casting needs a camera, a viewport and a scene
 * graph; deciding what was hit needs none of those, and keeping the two apart is
 * what lets the reverse lookup be checked against a hand-written intersection
 * with no renderer in the room. `raycast.ts` owns the camera side.
 *
 * Three decisions worth stating, because each has an obvious wrong version:
 *
 * - **The first *eligible* hit wins, not the first hit.** An object whose layer
 *   is hidden or locked is stepped over and the search carries on into whatever
 *   stands behind it. That is what a drafter means by locking the furniture to
 *   work on the walls: the chair stops swallowing clicks. Taking the nearest hit
 *   and filtering it afterwards would hand back nothing instead, and the wall
 *   behind the chair would be unpickable.
 * - **The layer is read from the id prefix**, through `selectableKindOf`, and
 *   not from the `BuildPartKind` the mesh was tagged with. A room is drawn by a
 *   floor slab and a ceiling — two part kinds, one layer — and its id already
 *   says which layer that is. One vocabulary, so the two cannot drift apart, and
 *   the eligibility test is the same one `selectionOps` applies to a pick made
 *   in the 2D canvas.
 * - **Nothing is written to.** No store, no selection, no `userData`, not even
 *   the intersection list. A hit is a fact about a ray; what to do about it
 *   belongs to whoever asked.
 */

import type { Object3D, Vector3 } from 'three';

import type { LevelId } from '@/domain/spatial/types';
import {
  readLayerState,
  selectableKindOf,
  type LayerStates,
  type SelectableKind,
} from '@/lib/selection/selectionOps';

import { entityAtHit, locateParts, type HitLike, type MergeResult } from '../build/merge';
import { readPartData, type BuildEntityId } from '../build/scene';

/* -------------------------------------------------------------------------- */
/* Vocabulary.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One crossing of the ray, in the shape `THREE.Raycaster` hands back.
 *
 * Declared structurally rather than imported as `THREE.Intersection` so a test
 * can write one out by hand: the reverse lookup is arithmetic on a triangle
 * index, and proving it right should not require a WebGL context. A real
 * `Intersection` satisfies this type as it stands, and so it is exactly what
 * `entityAtHit` already asks for — plus the two fields a hit test needs and a
 * reverse lookup does not.
 */
export interface RayIntersection extends HitLike {
  /** Distance from the ray origin, in scene units — metres. */
  readonly distance: number;
  /** Where the ray met the surface, in world space. */
  readonly point: Vector3;
}

/**
 * What the pointer is over: one model entity, and where it was touched.
 *
 * `point` is handed on by reference. `Raycaster` allocates a fresh vector per
 * intersection and never reuses it, so there is nothing to copy — but a caller
 * that intends to keep the vector past the next cast should clone it, exactly as
 * it would with any vector it did not make itself.
 */
export interface EntityHit {
  /** The model id: `W-12`, `R-04`, `D-7`. What a `commit()` is written against. */
  readonly entityId: BuildEntityId;
  /** The layer the entity belongs to, read from its id prefix. */
  readonly kind: SelectableKind;
  /** The storey it sits on; a scene holds several at once. */
  readonly levelId: LevelId;
  /** The touch point in world space, for a label anchored in the scene. */
  readonly point: Vector3;
  readonly distance: number;
  /** The object the ray actually met — a merged batch, or a loose mesh. */
  readonly object: Object3D;
}

/** What a lookup needs to know about the scene it is reading. */
export interface HitTestOptions {
  /**
   * The range table for the batched scene.
   *
   * `null` — the default — means nothing was batched, and every object is read
   * from its own `userData`. A scene holding both batched and loose meshes needs
   * no branch here: `entityAtHit` falls back on its own.
   */
  readonly merge?: MergeResult | null;
  /** Which layers are drawn and which are locked. Absent keys are both. */
  readonly layers?: LayerStates;
}

/* -------------------------------------------------------------------------- */
/* Eligibility.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * May something of this layer be picked right now?
 *
 * The same two conditions `selectionOps.isSelectable` applies — visible and
 * unlocked — minus the ones a raycast has already answered by hitting the thing.
 * A kind of `null` is a level container or a malformed id, and neither is
 * pickable.
 */
export function isPickableKind(kind: SelectableKind | null, layers: LayerStates): boolean {
  if (kind === null) {
    return false;
  }

  const layer = readLayerState(layers, kind);

  return layer.visible && !layer.locked;
}

/* -------------------------------------------------------------------------- */
/* Internals.                                                                  */
/* -------------------------------------------------------------------------- */

/** The entity behind one hit: through the range table, or off the mesh itself. */
function readHitEntity(
  intersection: RayIntersection,
  merge: MergeResult | null,
): { readonly entityId: BuildEntityId; readonly levelId: LevelId } | null {
  if (merge !== null) {
    const entityId = entityAtHit(merge, intersection);

    if (entityId !== null) {
      // Every part of one entity sits on one storey, so the first location is as
      // good as any for the level — a room's slab and its ceiling cannot disagree.
      const located = locateParts(merge, entityId)[0];

      if (located !== undefined) {
        return { entityId, levelId: located.part.levelId };
      }
    }
  }

  const data = readPartData(intersection.object);

  return data === null ? null : { entityId: data.entityId, levelId: data.levelId };
}

/* -------------------------------------------------------------------------- */
/* Public functions.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The entity one crossing stands for, or `null` when it stands for none.
 *
 * `null` covers three different disappointments and deliberately does not say
 * which: the object carries no tag, the batch was hit on no face the table
 * knows, or the layer is hidden or locked. A caller walking a list of
 * intersections treats all three the same way — keep looking — and
 * `firstEntityHit` is that walk.
 */
export function resolveHit(
  intersection: RayIntersection,
  options: HitTestOptions = {},
): EntityHit | null {
  const found = readHitEntity(intersection, options.merge ?? null);

  if (found === null) {
    return null;
  }

  const kind = selectableKindOf(found.entityId);

  // Split from the call so the compiler narrows `kind` for the result below;
  // `isPickableKind` refuses `null` too, and repeating it here costs nothing.
  if (kind === null || !isPickableKind(kind, options.layers ?? {})) {
    return null;
  }

  return {
    distance: intersection.distance,
    entityId: found.entityId,
    kind,
    levelId: found.levelId,
    object: intersection.object,
    point: intersection.point,
  };
}

/**
 * The nearest entity the ray met that may actually be picked.
 *
 * The list is walked in the order it was given, which for `Raycaster` output is
 * nearest first. It is not re-sorted: sorting thirty times a second to reproduce
 * an order the caster already guaranteed is a cost paid for nothing.
 */
export function firstEntityHit(
  intersections: readonly RayIntersection[],
  options: HitTestOptions = {},
): EntityHit | null {
  for (const intersection of intersections) {
    const hit = resolveHit(intersection, options);

    if (hit !== null) {
      return hit;
    }
  }

  return null;
}
