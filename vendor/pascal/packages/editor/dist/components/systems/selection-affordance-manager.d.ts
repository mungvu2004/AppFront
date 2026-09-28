/**
 * Editor-mounted dispatcher for a kind's selection-time editing UI.
 *
 * Some kinds expose drag-to-edit affordances that should appear only
 * while a single node of that kind is selected — duct / pipe / lineset
 * path-point handles, fitting Alt-axis-cycling listeners. These read
 * `useEditor` (grid snap step, rotation axis) and render the editor's
 * `DimensionPill`, so they must NOT ride in `def.system` (which the
 * viewer package mounts for the read-only route). The kind declares the
 * component under `def.affordanceTools.selection` and this manager —
 * mounted inside the editor only — loads it for the selected kind.
 */
export declare function SelectionAffordanceManager(): import("react").JSX.Element | null;
//# sourceMappingURL=selection-affordance-manager.d.ts.map