import { type AnyNode } from '@pascal-app/core';
/**
 * Ghost-preview duplicate / move tool for DWV pipe runs — the plumbing
 * sibling of `MoveDuctSegmentTool`. Pipes are always round, so the ghost
 * is a translucent cylinder per section (no rect branch).
 *
 * **Duplicate** (`metadata.isNew`): pure drag-to-place — NOTHING is
 * inserted into the scene until the commit click. A translucent ghost of
 * the run rides the cursor inside a footprint bounding box — the same
 * affordance other items get — and Figma-style alignment guides snap the
 * box's edges to nearby geometry. The next grid click calls `createNode`;
 * Esc discards. The run's Y coords (slope) ride along untouched: the move
 * only shifts XZ.
 *
 * **Move** (existing run): the real node's mesh is hidden while the same
 * ghost + box tracks the cursor; the commit click writes the translated
 * `path` and reveals it, Esc reveals it unchanged.
 *
 * Wired via `def.affordanceTools.move`.
 */
export declare const MovePipeSegmentTool: React.FC<{
    node: AnyNode;
}>;
export default MovePipeSegmentTool;
//# sourceMappingURL=move-tool.d.ts.map