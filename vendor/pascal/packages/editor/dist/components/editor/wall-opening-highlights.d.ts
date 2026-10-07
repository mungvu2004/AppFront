/**
 * When a wall is selected, draws a translucent indigo highlight (filled block
 * + outline) over each door / window it hosts. Openings whose `openingKind`
 * is `'opening'` have no visible geometry, so without this affordance the
 * user can't tell an editable cutout lives there — the fill marks it (and
 * stays out of the way of clicking the opening itself, which selects it).
 *
 * Highlights are portalled to the scene root so they sit outside the wall's
 * selection-outline subtree and keep their own accent colour.
 */
export declare function WallOpeningHighlights(): import("react").JSX.Element | null;
export default WallOpeningHighlights;
//# sourceMappingURL=wall-opening-highlights.d.ts.map