/**
 * Bumps after the 3D meshes have had a chance to settle following a scene
 * change. `computeGroupBox` reads mesh WORLD bounds, but a scene commit
 * (undo/redo included) reaches the meshes asynchronously — renderers
 * reconcile on the next React commit and the geometry systems rebuild in the
 * next frame — so anything that derives geometry from the meshes in the same
 * render as the `nodes` change reads STALE positions. Depend on this epoch
 * (alongside `nodes`) to recompute once more after two animation frames,
 * when transforms and rebuilt geometry are in place.
 */
export declare function useMeshSettleEpoch(nodes: unknown): number;
//# sourceMappingURL=use-mesh-settle-epoch.d.ts.map