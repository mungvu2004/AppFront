/**
 * Cursor-driven placement for registered kinds in the floor plan.
 *
 * Activates when `useEditor.movingNode` is set to a node whose kind is
 * registered with `def.floorplan`. Two dispatch paths:
 *
 *   1. **`def.floorplanMoveTarget` present** (door / window / item):
 *      kind-specific 2D move handler with wall / ceiling / slab
 *      anchor logic. Pointer events feed `session.apply` which writes
 *      directly to `useScene`; pointer-up does the single-undo dance
 *      (revert→resume→re-apply) if `canCommit()` is true.
 *   2. **Fallback — generic free-floating translate**: imperatively
 *      translates the rendered SVG entry on pointer-move, commits via
 *      `updateNode` on pointer-up. Used by shelf / spawn / fence /
 *      etc. whose move is "translate position on X/Z plane".
 *
 * Lives outside the `floorplan-panel.tsx` monolith. Coordinate
 * conversion routes through the scene `<g>`'s `getScreenCTM` so
 * cursor → meters accounts for pan / zoom / building rotation.
 */
export declare function FloorplanRegistryMoveOverlay(): null;
//# sourceMappingURL=floorplan-registry-move-overlay.d.ts.map