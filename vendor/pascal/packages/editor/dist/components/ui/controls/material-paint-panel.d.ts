/**
 * Material picker for paint mode. Embedders render this wherever paint controls
 * belong (the community editor places it in the Build sidebar while paint mode
 * is active). It fills its container's height and lays out as three bands: a
 * fixed control/category header, a single scrolling catalog grid, and a fixed
 * scene-material footer (always visible, with a `+` to add a custom material).
 */
export type MaterialPaintPanelProps = {
    /** When provided, the catalog grid leads with a "New material" tile that invokes it. */
    onCreateMaterialRequest?: () => void;
};
export declare function MaterialPaintPanel({ onCreateMaterialRequest }: MaterialPaintPanelProps): import("react").JSX.Element;
//# sourceMappingURL=material-paint-panel.d.ts.map