import { type RidgeVentNode } from '@pascal-app/core';
/**
 * Ridge-vent move tool. Mirrors the box-vent move flow — ghost follows
 * the cursor over any roof segment, click commits the new position +
 * parent segment in one undoable step. The ridge sits along the ridge
 * line, so we don't tilt the preview by the segment slope (the renderer
 * places the vent on the peak); we just yaw it with the roof + segment.
 */
export default function MoveRidgeVentTool({ node }: {
    node: RidgeVentNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=move-tool.d.ts.map