/**
 * Figma-style alignment guides for the 2D floor plan.
 *
 * Subscribes to the editor-local `useAlignmentGuides` store (separate
 * from the core store the 3D layer reads). Guides come in
 * building-local meters, so the layer is mounted INSIDE the rotated
 * `<g data-floorplan-scene>` — the SVG transform that takes the rest
 * of the floor-plan geometry from local → screen carries the guide
 * lines too. Pill labels are counter-rotated by `sceneRotationDeg`
 * (from `FloorplanRenderProvider`) so they stay upright even when the
 * scene `<g>` is rotated by building rotation.
 *
 * Each guide renders as a red line between the moving and matched
 * candidate anchors with small `×` end-caps. A distance pill is drawn
 * at the midpoint when the perpendicular gap is non-zero.
 *
 * Stroke widths and handle radii are scaled by `unitsPerPixel` so they
 * stay a constant size on screen no matter the zoom.
 */
export declare const FloorplanAlignmentGuideLayer: import("react").MemoExoticComponent<() => import("react").JSX.Element | null>;
//# sourceMappingURL=floorplan-alignment-guide-layer.d.ts.map