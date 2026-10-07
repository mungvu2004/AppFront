import { type ChimneyNode } from '@pascal-app/core';
/**
 * Drag-to-place tool for chimney duplicate / move. Receives the moving
 * node (a clone with `id` stripped + `metadata.isNew = true` after a
 * Duplicate action) via `node` prop, shows the same ghost preview as
 * placement, and on click commits the cloned chimney to the hit
 * segment with that segment's local coords.
 *
 * Mirrors `tool.tsx`'s placement preview — the only differences are
 * (a) the ghost is built from the moving node so the duplicate
 * preserves the original's body shape/material/etc., and (b) on click
 * we keep all of the clone's fields and only overwrite host segment +
 * position. Mounted via `def.affordanceTools.move`.
 */
declare const MoveChimneyTool: ({ node }: {
    node: ChimneyNode;
}) => import("react").JSX.Element | null;
export default MoveChimneyTool;
//# sourceMappingURL=move-tool.d.ts.map