import { type DormerNode } from '@pascal-app/core';
/**
 * Drag-to-place tool for dormer duplicate / move. Receives the moving
 * node (a clone with `id` stripped + `metadata.isNew = true` after a
 * Duplicate action) via `node` prop, shows the same ghost preview as
 * placement, and on click commits the cloned dormer to the hit segment.
 *
 * On cancel, a duplicate clone is deleted and an existing dormer is
 * restored to its original segment + position. Mounted via
 * `def.affordanceTools.move`.
 */
declare const MoveDormerTool: ({ node }: {
    node: DormerNode;
}) => import("react").JSX.Element | null;
export default MoveDormerTool;
//# sourceMappingURL=move-tool.d.ts.map