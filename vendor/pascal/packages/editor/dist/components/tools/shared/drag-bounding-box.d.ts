interface DragBoundingBoxProps {
    /** Node whose rendered geometry is measured for the box extents. */
    nodeId: string;
    /** Footprint origin on the floor, `[x, 0, z]` — the node's live position. */
    position: [number, number, number];
    /** Y rotation (radians) applied to the box, matching the dragged node. */
    rotationY?: number;
    /** Declared `[width, height, depth]`, used until/if the mesh can't be measured. */
    fallbackSize?: [number, number, number];
    /**
     * Hard override for the box extents — wins over both mesh measurement and
     * `fallbackSize`. Use when the rendered mesh contains extras the user
     * wouldn't read as "the thing being dragged" (e.g. an elevator whose mesh
     * includes per-level landings outside the shaft footprint).
     */
    size?: [number, number, number];
    /** Local center of `size`. Defaults to the node origin plus half-height. */
    center?: [number, number, number];
    /** Y center of the box in the node's local frame. Defaults to `size[1] / 2`. */
    centerY?: number;
    color?: number;
}
/**
 * Footprint box drawn around a node while it is being dragged — the same
 * affordance items get during placement: a wireframe cube spanning the node's
 * full measured extent plus a ground plane with a radial opacity gradient
 * (transparent in the centre, opaque toward the edges). Overlay layer +
 * `depthTest: false` keep it drawn on top of scene geometry throughout the
 * drag, and the box visualises the bounds that drive alignment snapping.
 */
export declare function DragBoundingBox({ nodeId, position, rotationY, fallbackSize, size, center, centerY, color, }: DragBoundingBoxProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=drag-bounding-box.d.ts.map