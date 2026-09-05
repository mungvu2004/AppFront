/**
 * The thin layer a half-finished edit is drawn on, over the model but never in it.
 *
 * While somebody drags a slider the model on screen has to follow, and there
 * are only two ways to make it: rebuild the storey, or draw the one part that
 * changed on top of the one that has not. Rebuilding is what the worker queue
 * does — a full pass, asynchronous, with a progress bar — and running it dozens
 * of times a second is not a preview, it is a hang. So the preview is an
 * overlay: a small group of meshes for the parts being edited, added beside the
 * real model, with the real parts hidden underneath.
 *
 * ## Three things this layer refuses to do
 *
 * - **It never touches the real mesh tree.** The overlay is its own group, so
 *   dropping a preview is removing that group — not rebuilding anything, not
 *   restoring anything the layer had modified. The caller un-hides what it hid;
 *   nothing else has to be put back, because nothing else was moved.
 * - **It never invents a colour.** Materials are handed in by the caller, which
 *   got them from the P-06 colouring of the real model. A preview that painted
 *   itself would be a design-system colour nobody approved, and a wall that
 *   changed colour the moment you touched it would read as a different wall.
 * - **It never casts or receives a shadow.** This is the load-bearing one. The
 *   viewer's shadow map is drawn when the model changes, not every frame; a
 *   preview mesh that cast a shadow would make it change on every step of a
 *   drag, and the frame loop's whole point — draw only what is different, and
 *   only the cheap part of it — would be spent on re-rendering the depth pass
 *   sixty times a second. A previewed wall therefore has no shadow of its own
 *   while it is being held, and gets one back the moment it is committed and
 *   the real model is rebuilt.
 *
 * ## Geometry on the main thread, and why that is the right call here
 *
 * `buildFloorMesh` extrudes on the calling thread — which is exactly what the
 * worker exists to avoid for a whole storey of thirty-four rooms. For one wall
 * it is the opposite trade: a single extrusion is a fraction of a millisecond,
 * and a round trip to a worker costs a message, a copy, and a frame of latency
 * for a picture whose only job is to be instant. The narrowing that keeps this
 * to one wall is {@link narrowFloorInput}'s job, and it is the reason this
 * module may build at all.
 */

import { Group, Mesh, type Material } from 'three';

import { buildFloorMesh, type BuildFloorInput } from '../build/floor';
import { readPartData, type BuildPartKind } from '../build/scene';
import { disposeFloor } from '../perf/dispose';

export interface PreviewLayerOptions {
  /**
   * The material a part of this kind is drawn with, or `undefined` to leave the
   * mesh with whatever `buildFloorMesh` gave it.
   *
   * Borrowed, not owned: the layer never disposes or releases what comes back
   * from here, because the real model is still drawing with the same instances.
   */
  readonly materialOf: (kind: BuildPartKind) => Material | undefined;
  /** Swaps the builder out for a test that must not extrude real geometry. */
  readonly build?: ((input: BuildFloorInput) => Group) | undefined;
}

export interface PreviewLayer {
  /** The group to add to the scene. Empty until {@link PreviewLayer.show}. */
  readonly root: Group;
  /**
   * Draw these parts, replacing whatever the layer was showing.
   *
   * @returns how many meshes the overlay now holds.
   */
  readonly show: (input: BuildFloorInput) => number;
  /** Drop what is drawn. `true` when there was something to drop. */
  readonly clear: () => boolean;
  /** How many meshes are on the overlay right now. */
  readonly meshCount: () => number;
  /** How many times geometry has been built — for a test counting the cost. */
  readonly buildCount: () => number;
  /** Drop everything and leave nothing behind. Safe to call twice. */
  readonly dispose: () => void;
}

/**
 * Build an overlay bound to one scene.
 *
 * The layer owns its `root` group and the geometry inside it, and nothing else.
 *
 * @example
 * const preview = createPreviewLayer({ materialOf: (kind) => painted.get(kind) });
 * scene.add(preview.root);
 * preview.show(narrowFloorInput(storey, ['W-000000001']));
 */
export function createPreviewLayer(options: PreviewLayerOptions): PreviewLayer {
  const build = options.build ?? buildFloorMesh;
  const root = new Group();

  let shown: Group | null = null;
  let meshCount = 0;
  let buildCount = 0;

  const clear = (): boolean => {
    if (shown === null) {
      return false;
    }

    // `disposeMaterials: false` and no cache: every material on the overlay is
    // borrowed from the real model, and freeing one here would take it out from
    // under the walls that are still drawn with it. The geometry IS the layer's
    // own — built by this module, one drag step ago — so that goes.
    // `disposeFloor` detaches the group it is given, so the overlay empties
    // itself; there is no second `remove` to make.
    disposeFloor(shown, { disposeMaterials: false });
    shown = null;
    meshCount = 0;

    return true;
  };

  return {
    root,

    show: (input) => {
      clear();

      const group = build(input);
      buildCount += 1;

      group.traverse((object) => {
        if (!(object instanceof Mesh)) {
          return;
        }

        meshCount += 1;

        const kind = readPartData(object)?.kind;
        const material = kind === undefined ? undefined : options.materialOf(kind);

        if (material !== undefined) {
          object.material = material;
        }

        // The shadow map stays as the real model left it — see the docblock.
        object.castShadow = false;
        object.receiveShadow = false;
      });

      shown = group;
      root.add(group);

      return meshCount;
    },

    clear,
    meshCount: () => meshCount,
    buildCount: () => buildCount,

    dispose: () => {
      clear();
      root.removeFromParent();
    },
  };
}
