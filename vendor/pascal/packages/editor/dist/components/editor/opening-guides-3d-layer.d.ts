/**
 * Wall-plane proximity / alignment guides for the 3D editor — the spatial twin
 * of the floor-plan placement dimensions + equal-spacing badges. Subscribes to
 * `useOpeningGuides` (published by the door/window move, placement, and resize
 * interactions each drag tick) and draws sill/head + edge-proximity dimensions, a sill-alignment line, and
 * equal-spacing badges. Coordinates are already in the move tool's render frame
 * (the producer reuses the cursor's `wallLocalToWorld`, so they share the cursor's
 * building-local frame), so this layer mounts beside `Alignment3DGuideLayer` and
 * renders them as-is.
 */
export declare const OpeningGuides3DLayer: import("react").MemoExoticComponent<() => import("react").JSX.Element | null>;
//# sourceMappingURL=opening-guides-3d-layer.d.ts.map