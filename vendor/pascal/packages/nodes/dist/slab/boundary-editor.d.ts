import { type SlabNode } from '@pascal-app/core';
/**
 * Phase 5 Stage D — slab boundary editor (registry-driven).
 *
 * Thin wrapper around the shared `PolygonEditor`. Activates when a
 * slab is selected in structure/select mode (not currently editing a
 * hole). The heavy lifting — vertex drag, edge slide, snap, history
 * bracketing — lives in `PolygonEditor` itself.
 *
 * Mounted by ToolManager via `def.affordanceTools['boundary-edit']`.
 *
 * Drag flow: every pointer tick the editor hands back the in-flight
 * polygon through `onPolygonPreview`; we mirror it onto
 * `useLiveNodeOverrides` + `markDirty` so `GeometrySystem` rebuilds
 * the slab mesh at pointer rate. On release the editor calls
 * `onPolygonChange` once with the final polygon — that's the single
 * `updateNode` tracked by undo. The follow-up `onPolygonPreview(null)`
 * drops the override so subscribers read from the store again.
 */
export declare const SlabBoundaryEditor: React.FC<{
    slabId: SlabNode['id'];
}>;
export default SlabBoundaryEditor;
//# sourceMappingURL=boundary-editor.d.ts.map