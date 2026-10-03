import { type ColumnNode } from '@pascal-app/core';
/**
 * Translucent, non-interactive ghost of a column — the placement tool's
 * cursor preview, mirroring `ShelfPreview`. Builds the same geometry tree
 * as the real renderer via `<ColumnBody>` but:
 *   - clones the material and makes it transparent (cloning is required:
 *     `createLegacyColumnMaterial` can hand back a shared/cached instance, and
 *     mutating it would turn every committed column see-through);
 *   - disables raycast on every mesh so the ghost doesn't intercept the
 *     placement cursor ray (which would stall `grid:move`);
 *   - renders at the local origin so the caller's cursor group positions it.
 */
export declare const ColumnPreview: ({ node }: {
    node: ColumnNode;
}) => import("react").JSX.Element;
export declare const ColumnRenderer: ({ node: rawNode }: {
    node: ColumnNode;
}) => import("react").JSX.Element;
export default ColumnRenderer;
//# sourceMappingURL=renderer.d.ts.map