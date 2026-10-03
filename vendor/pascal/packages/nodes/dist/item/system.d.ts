/**
 * Registry-driven item system bundle.
 *
 *  - **`ItemSystem`** — applies attachTo-driven transforms each frame
 *    (wall-side z-offset, slab elevation, ceiling mounting).
 *  - **`ItemLightSystem`** — manages light sources attached to items
 *    (lamps, ceiling lights, etc.).
 *  - **`NodeBatchSystem`** — once nodes stop changing, draws items, columns,
 *    ceilings, slabs and wall-hosted openings through per-material BatchedMeshes; lit or
 *    edited nodes draw themselves (see ../shared/node-batch/types.ts).
 *    Mounted from the item bundle because it must mount exactly once and
 *    every registered kind's system mounts scene-wide.
 */
declare const ItemSystems: () => import("react").JSX.Element;
export default ItemSystems;
//# sourceMappingURL=system.d.ts.map