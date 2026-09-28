import { type AnyNode } from '@pascal-app/core';
/**
 * Ghost-preview duplicate / move tool for liquid lines — the path-mover sibling
 * of `MoveLinesetTool`. A translucent cylinder at the line's OD per section
 * stands in for the run (mirrors the draw tool's `PreviewSegment`).
 *
 * **Duplicate** (`metadata.isNew`): pure drag-to-place — NOTHING is inserted
 * into the scene until the commit click. A translucent ghost rides the cursor
 * inside a footprint bounding box and Figma-style alignment guides snap the
 * box's edges to nearby geometry. The next grid click calls `createNode`; Esc
 * discards. The run's Y coords ride along untouched: the move only shifts XZ.
 *
 * **Move** (existing run): the real node's mesh is hidden while the same ghost
 * + box tracks the cursor; the commit click writes the translated `path` and
 * reveals it, Esc reveals it unchanged.
 *
 * Wired via `def.affordanceTools.move`.
 */
export declare const MoveLiquidLineTool: React.FC<{
    node: AnyNode;
}>;
export default MoveLiquidLineTool;
//# sourceMappingURL=move-tool.d.ts.map