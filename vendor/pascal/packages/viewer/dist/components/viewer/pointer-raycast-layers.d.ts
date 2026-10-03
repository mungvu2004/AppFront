/**
 * Lets R3F's pointer raycaster see geometry a collective batch draws.
 *
 * R3F picks with one shared raycaster whose default mask is `SCENE_LAYER`
 * alone. A wall sewn into its level's merged mesh is moved off that layer
 * (`hideBatchedWall`) while staying in the graph with its pointer handlers
 * intact — so without this the wall answers no hover, paint or click the
 * moment it joins a batch, and a floor's walls go dead a fraction of a second
 * after the last edit settles.
 *
 * Additive rather than `setSurfaceRaycastLayers`: that helper resets the mask
 * for the private raycasters callers build per query, and this one is shared.
 */
export declare const PointerRaycastLayers: () => null;
//# sourceMappingURL=pointer-raycast-layers.d.ts.map