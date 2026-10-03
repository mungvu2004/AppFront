import { type AnyNode } from '@pascal-app/core';
/**
 * Ghost-preview duplicate / move tool for duct runs.
 *
 * **Duplicate** (`metadata.isNew`): pure drag-to-place — NOTHING is
 * inserted into the scene until the commit click. A translucent ghost of
 * the run (cylinders / boxes matching its profile) rides the cursor inside
 * a footprint bounding box — the same affordance other items get — and
 * Figma-style alignment guides snap the box's edges to nearby geometry. The
 * next grid click calls `createNode`; Esc discards.
 *
 * **Move** (existing run): the real node is hidden while the same ghost +
 * box tracks the cursor; the commit click writes the translated `path` and
 * reveals it, Esc reveals it unchanged.
 *
 * Wired via `def.affordanceTools.move`.
 */
export declare const MoveDuctSegmentTool: React.FC<{
    node: AnyNode;
}>;
export default MoveDuctSegmentTool;
//# sourceMappingURL=move-tool.d.ts.map