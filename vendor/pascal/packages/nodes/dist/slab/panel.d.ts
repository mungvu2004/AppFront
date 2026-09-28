/**
 * Phase 5 Stage E — slab inspector (kind-owned).
 *
 * 1:1 port of the legacy `SlabPanel`. Mounted via
 * `parametrics.customPanel` because the slab editor has shape-specific
 * concerns (elevation presets, area display, holes list with auto-
 * vs-manual provenance) that don't fit the auto-derived
 * `<ParametricInspector>` field model yet. When the inspector grows
 * `list` / `computed` / `action` field kinds, this panel collapses
 * into `parametrics.groups`.
 */
export declare function SlabPanel(): import("react").JSX.Element | null;
export default SlabPanel;
//# sourceMappingURL=panel.d.ts.map