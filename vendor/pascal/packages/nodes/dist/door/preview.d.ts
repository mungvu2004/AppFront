import type { DoorNode } from './schema';
/**
 * Translucent preview of a door — used by the placement tool's floating ghost.
 *
 * Builds the door mesh via buildDoorPreviewMesh (so the preview shape stays in
 * lockstep with committed doors), then applies ghost treatment (translucent,
 * raycast-off, tinted red if invalid).
 *
 * The root mesh's layer is set to EDITOR_LAYER because the invisible hitbox
 * material on SCENE_LAYER would poison the WebGPU MRT pass (project gotcha).
 */
declare const DoorPreview: ({ node, invalid, valid, }: {
    node: DoorNode;
    invalid?: boolean;
    valid?: boolean;
}) => import("react").JSX.Element;
export default DoorPreview;
//# sourceMappingURL=preview.d.ts.map