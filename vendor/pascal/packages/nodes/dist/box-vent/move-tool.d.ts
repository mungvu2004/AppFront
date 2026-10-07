import { type BoxVentNode } from '@pascal-app/core';
/**
 * Box-vent move tool. Mirrors the placement tool's cursor behaviour
 * (ghost follows the roof surface; click on a roof commits) but for an
 * already-existing vent: the original mesh is hidden during the drag,
 * the ghost tracks the cursor with the correct slope tilt + segment yaw,
 * and the click updates the node's position + parent segment in one
 * undoable step. Cancel restores the original transform; if the node was
 * freshly cloned (`metadata.isNew`), cancel deletes it instead.
 */
export default function MoveBoxVentTool({ node }: {
    node: BoxVentNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=move-tool.d.ts.map