import { useEffect, useRef, useState } from 'react';

import type { Group, Material, Object3D } from 'three';

import { buildFloorMesh, type BuildFloorInput } from '@/lib/three/build/floor';
import type { BuildPartKind } from '@/lib/three/build/scene';
import { disposeFloor, type ResourceLedger } from '@/lib/three/perf/dispose';
import {
  paintByPartKind,
  sharedMaterialCache,
  type MaterialCache,
} from '@/lib/three/perf/materialCache';

/**
 * One storey on screen at a time, and the old one actually freed.
 *
 * Three.js will not free a vertex buffer for you. A view that swaps storeys by
 * building a new group and letting go of the old one leaks the whole old storey —
 * a hundred and ten geometries a swap — and the leak is invisible in a heap
 * snapshot, because in the heap there is nothing left to see. Twenty swaps and the
 * tab is gone.
 *
 * Building and freeing are therefore not two things a view does; they are one
 * thing, and this hook is that one thing. The storey is built in an effect and
 * freed in that effect's cleanup, so React's own lifecycle guarantees the pairing:
 * there is no path through a re-render, a swap, an unmount or a thrown error that
 * frees one without the other. A view that uses this hook cannot leak a storey by
 * forgetting, because there is nothing left for it to forget.
 *
 * **What triggers a rebuild is stated, not inferred.** The storey is rebuilt when
 * its level id changes, or when the caller bumps {@link
 * FloorLifecycleOptions.revision} — never because the `model` object happens to be
 * a new object. That is a deliberate refusal of the obvious design: keying the
 * effect on the model's identity means the entirely natural
 * `useFloorLifecycle({ model: buildModel(state) })` builds a new object on every
 * render, rebuilds the storey, sets state, renders again, and locks the tab in an
 * infinite rebuild. Nothing in the type system stops a caller writing that, so the
 * hook is built so that writing it is harmless.
 *
 * The cost of that choice is one thing the caller must do: after editing a storey
 * **in place** — moving a wall, cutting an opening — bump `revision`, because the
 * level id did not change and the hook is deliberately not watching the object.
 * Everything else in the options is read at build time and never triggers a
 * rebuild, which is what stops an inline `createMaterial` arrow from rebuilding
 * forty-eight walls on every render.
 *
 * Materials are the deliberate exception to the freeing: they come from a
 * reference-counted {@link MaterialCache}, so the four materials a storey shares
 * survive that storey closing if another one is still drawing with them. Passing
 * no `createMaterial` leaves the meshes with three's per-mesh defaults, which is
 * the arrangement `budget.ts` warns about — one material per object, a hundred and
 * ten of them against a cap of forty.
 */
export interface FloorLifecycleOptions {
  /**
   * The storey to draw, or `null` for none.
   *
   * Read when a build happens, not watched. Building a fresh object on every
   * render is safe and costs nothing.
   */
  readonly model: BuildFloorInput | null;
  /**
   * Bump this to rebuild a storey that changed without changing its level id.
   *
   * The level id already rebuilds on its own, so this is for edits **within** one
   * storey: a wall moved, an opening cut. A store that versions its data has this
   * number already; anything that changes when the storey changes will do.
   */
  readonly revision?: string | number;
  /**
   * Where to add the storey. `null` leaves the group detached for the caller to
   * place.
   *
   * Compared by identity, so moving the storey to a different scene rebuilds it —
   * which is correct, and is also a reason to keep the scene object stable.
   */
  readonly parent?: Object3D | null;
  /**
   * The material for each part kind, shared across every mesh of that kind.
   *
   * The caller's, and it has to be: a colour comes from a token by way of
   * `src/lib/coloring`, and a hook that picked one would be inventing a colour the
   * design system never approved. Leave it out to get no materials at all, which
   * is what the builders produce.
   */
  readonly createMaterial?: (kind: BuildPartKind) => Material;
  /** Where shared materials come from. The shared cache by default. */
  readonly materials?: MaterialCache;
  /**
   * A ledger to register the storey with, so a leak becomes a number.
   *
   * Optional, and worth passing in development: it is the only thing that can tell
   * you the freeing is working, because a storey that leaked is one that is no
   * longer in the scene to be counted.
   */
  readonly ledger?: ResourceLedger;
}

export interface FloorLifecycleState {
  /** The storey currently built, or `null` before the first one and after the last. */
  readonly group: Group | null;
}

/**
 * Build a storey, keep exactly one alive, and free it when it is replaced or the
 * view goes away.
 *
 * ```tsx
 * const { group } = useFloorLifecycle({ model, parent: scene, ledger });
 * ```
 *
 * @see disposeFloor for what freeing a storey actually involves.
 */
export function useFloorLifecycle(options: FloorLifecycleOptions): FloorLifecycleState {
  const { parent = null, revision = null } = options;

  // The whole options object is read at build time rather than watched, so no
  // amount of inline object or arrow literals in the caller can cause a rebuild.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const [group, setGroup] = useState<Group | null>(null);

  // The two things that really mean "a different storey". `null` when there is
  // none, which is a value the dependency list can compare like any other.
  const levelId = options.model?.level.id ?? null;

  useEffect(() => {
    const model = latest.current.model;
    if (model === null) {
      setGroup(null);
      return;
    }

    // Read once, and close over them: the cleanup has to hand the materials back
    // to the very cache they were taken from, whatever the options say by then.
    const { createMaterial, ledger } = latest.current;
    const cache = latest.current.materials ?? sharedMaterialCache;

    const built = buildFloorMesh(model);
    if (createMaterial !== undefined) {
      paintByPartKind(built, cache, createMaterial);
    }
    ledger?.track(built);
    parent?.add(built);
    setGroup(built);

    return () => {
      setGroup((current) => (current === built ? null : current));
      disposeFloor(built, { materials: cache });
    };
  }, [levelId, revision, parent]);

  return { group };
}
