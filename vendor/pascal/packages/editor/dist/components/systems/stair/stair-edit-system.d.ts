/**
 * Imperatively toggles the Three.js visibility of stair objects based on the
 * editor selection — without causing React re-renders in StairRenderer.
 *
 * When a stair (or one of its segments) is selected:
 *   - merged-stair mesh is hidden
 *   - segments-wrapper group is shown (individual segments visible for editing)
 *   - all children are marked dirty so StairSystem rebuilds their geometry
 *
 * When deselected:
 *   - merged-stair mesh is shown
 *   - segments-wrapper group is hidden
 */
export declare const StairEditSystem: () => null;
//# sourceMappingURL=stair-edit-system.d.ts.map