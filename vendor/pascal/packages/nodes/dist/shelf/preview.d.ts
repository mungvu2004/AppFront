import type { ShelfNode } from './schema';
/**
 * Translucent preview of a shelf — used by the placement tool's cursor
 * and the registry mover. Defers to `buildShelfGeometry` so the preview
 * shape stays in lockstep with whatever the actual shelf will render,
 * then walks the result, **clones** each mesh's material, and mutates
 * the clone for a translucent ghost.
 *
 * Cloning is non-negotiable: shelf geometry may receive materials from
 * shared viewer caches, so mutating `mat.transparent = true` here would
 * leak into committed shelves using the same material.
 *
 * Building the full geometry tree per-frame would be wasteful, so we
 * memoize the group + dispose the per-mesh material clones on unmount.
 * Geometry is intentionally NOT disposed — `buildShelfGeometry` creates
 * fresh BufferGeometry per call, but if a future revision returns
 * cached geometry, disposing here would corrupt later renders. Keep the
 * cleanup focused on what the preview itself created (the clones).
 *
 * **Raycast is disabled** on every preview mesh: the cursor follows the
 * shelf, so without this the preview itself would intercept the cursor
 * ray, `grid:move` would stop firing as soon as the preview entered the
 * cursor cone, and the placement tool would lose track of the cursor's
 * grid position. Disabling raycast lets the ray pass through the ghost
 * to the grid plane below.
 */
declare const ShelfPreview: ({ node }: {
    node: ShelfNode;
}) => import("react").JSX.Element;
export default ShelfPreview;
//# sourceMappingURL=preview.d.ts.map