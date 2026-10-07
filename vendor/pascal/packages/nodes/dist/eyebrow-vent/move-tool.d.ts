import { type EyebrowVentNode } from '@pascal-app/core';
/**
 * Eyebrow-vent move tool. Mirrors the box-vent / cupola move flow: the
 * original mesh hides during the drag, a ghost tracks the cursor with the
 * correct slope tilt + segment yaw, and the click updates the node's position
 * + parent segment in one undoable step (reparenting between segments when
 * needed). Cancel restores the original transform, or deletes a freshly-cloned
 * vent.
 */
export default function MoveEyebrowVentTool({ node }: {
    node: EyebrowVentNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=move-tool.d.ts.map