import { type AnyNode } from '@pascal-app/core';
/**
 * Ghost-preview duplicate / move tool for refrigerant linesets — the
 * refrigerant-loop sibling of `MovePipeSegmentTool`. A lineset is a
 * suction + liquid copper pair; the ghost stands in with a single
 * translucent cylinder at the suction OD per section (mirrors the draw
 * tool's `PreviewSegment`).
 *
 * **Duplicate** (`metadata.isNew`): pure drag-to-place — NOTHING is
 * inserted into the scene until the commit click. A translucent ghost of
 * the run rides the cursor inside a footprint bounding box — the same
 * affordance other items get — and Figma-style alignment guides snap the
 * box's edges to nearby geometry. The next grid click calls `createNode`;
 * Esc discards. The run's Y coords ride along untouched: the move only
 * shifts XZ.
 *
 * **Move** (existing run): the real node's mesh is hidden while the same
 * ghost + box tracks the cursor; the commit click writes the translated
 * `path` and reveals it, Esc reveals it unchanged.
 *
 * Wired via `def.affordanceTools.move`.
 */
export declare const MoveLinesetTool: React.FC<{
    node: AnyNode;
}>;
export default MoveLinesetTool;
//# sourceMappingURL=move-tool.d.ts.map