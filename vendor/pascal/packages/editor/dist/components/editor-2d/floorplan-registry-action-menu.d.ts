/**
 * Floating Move / Duplicate / Delete buttons that appear above the
 * selected registered kind in the floor plan view.
 *
 * Lives outside the floorplan-panel.tsx monolith. Reads selection from
 * `useViewer`, finds the rendered `[data-node-id]` <g> inside the floor
 * plan scene, polls its bounding rect via rAF while open, and portals
 * an HTML overlay positioned at the top of the bounding box.
 *
 * Buttons:
 *  - Move: sets `movingNode` in useEditor. Enabled when the kind has
 *    `capabilities.movable`, `def.floorplanMoveTarget`, OR
 *    `def.affordanceTools.move` (slab / ceiling). The
 *    `<FloorplanRegistryMoveOverlay>` / dispatcher picks the right path.
 *    Walls are excluded — their move is reached via the side-arrow
 *    handles emitted from `def.floorplan`, not via a menu button.
 *  - Curve (wall only): enters curve reshape mode. The selected wall's
 *    midpoint curve handle remains visible so it can be dragged in plan.
 *  - Add hole (slab + ceiling only): inserts a small default-square
 *    hole at the polygon centroid via `updateNode`. Mirrors the legacy
 *    `handleAddHole` in `floating-action-menu.tsx`.
 *  - Duplicate: creates a fresh subtree when the kind opts in, otherwise a
 *    root-only copy, then hands that real draft to the placement cursor.
 *  - Delete: calls `deleteNode(id)`. Cascade is handled by the registry's
 *    `relations.cascadeDelete` if declared on the def.
 *
 * Hidden while moving or curving so the menu does not compete with the active affordance.
 */
export declare function FloorplanRegistryActionMenu(): import("react").ReactPortal | null;
//# sourceMappingURL=floorplan-registry-action-menu.d.ts.map