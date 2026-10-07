import type { WindowNode } from './schema';
/**
 * Translucent preview of a window — used by the placement tool's floating ghost.
 *
 * Builds the window mesh via buildWindowPreviewMesh (so the preview shape stays in
 * lockstep with committed windows), then applies ghost treatment (translucent,
 * raycast-off, tinted red if invalid).
 *
 * The root mesh's layer is set to EDITOR_LAYER because the invisible hitbox
 * material on SCENE_LAYER would poison the WebGPU MRT pass (project gotcha).
 */
declare const WindowPreview: ({ node, invalid, valid, }: {
    node: WindowNode;
    invalid?: boolean;
    valid?: boolean;
}) => import("react").JSX.Element;
export default WindowPreview;
//# sourceMappingURL=preview.d.ts.map