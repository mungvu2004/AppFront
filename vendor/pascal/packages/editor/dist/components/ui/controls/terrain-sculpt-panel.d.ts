/**
 * Sculpt controls for terrain mode — verb, brush, and the two lot-wide actions.
 *
 * A panel rather than a floating HUD because the brush settings are the sort of
 * thing a user adjusts between strokes and then leaves alone, and because
 * sculpting already owns the whole viewport pointer: putting controls over the
 * canvas would put them over the surface being sculpted.
 *
 * Embedders mount this wherever their sculpt controls belong (the community
 * editor puts it in the Build sidebar while sculpt mode is active), exactly like
 * `MaterialPaintPanel`.
 */
export declare function TerrainSculptPanel(): import("react").JSX.Element;
//# sourceMappingURL=terrain-sculpt-panel.d.ts.map