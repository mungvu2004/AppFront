/**
 * Imperatively toggles the Three.js visibility of roof objects based on the
 * editor selection — without causing React re-renders in RoofRenderer.
 *
 * Full edit-mode (segment selected):
 *   - merged-roof mesh stays VISIBLE — it rebuilds live from each segment's
 *     trim override, so the edited cutaway matches the clean commit instead of
 *     exposing the per-segment meshes' abutting end-cap faces
 *   - segments-wrapper group stays hidden (handles render from RoofTrimHandles)
 *   - all children are marked dirty so RoofSystem rebuilds the merged shell
 *
 * Accessory-reveal mode (a dormer/chimney/etc. hosted on a segment is selected):
 *   - merged-roof mesh stays visible (we don't want the appearance to jump)
 *   - segments-wrapper group is shown ANYWAY so anything portaled into a
 *     segment's registered mesh (e.g. dormer in-world handle arrows that
 *     don't use `portal: 'grandparent'`) is no longer inheriting the
 *     wrapper's hidden flag
 *   - segment placeholder geometry is empty, so revealing the wrapper has
 *     no visible cost beyond letting the handle arrows render
 *
 * When deselected: merged-roof shown, segments-wrapper hidden.
 */
export declare const RoofEditSystem: () => import("react").JSX.Element;
//# sourceMappingURL=roof-edit-system.d.ts.map