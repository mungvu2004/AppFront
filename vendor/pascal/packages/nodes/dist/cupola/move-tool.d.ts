import { type CupolaNode } from '@pascal-app/core';
/**
 * Cupola move tool. Mirrors the box-vent move flow: the original mesh hides
 * during the drag, a ghost tracks the cursor with the correct slope tilt +
 * segment yaw, and the click updates the node's position + parent segment in
 * one undoable step (reparenting between segments when needed). Cancel
 * restores the original transform, or deletes a freshly-cloned cupola.
 */
export default function MoveCupolaTool({ node }: {
    node: CupolaNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=move-tool.d.ts.map