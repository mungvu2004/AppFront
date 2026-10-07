import { type CeilingNode } from '@pascal-app/core';
/**
 * Phase 5 Stage D — ceiling boundary editor (registry-driven).
 *
 * Thin wrapper around the shared `<PolygonEditor>` (same shape as
 * slab's boundary-editor). Activates when a ceiling is selected in
 * structure/select mode and no hole edit is in progress.
 *
 * Drag flow mirrors slab: `onPolygonPreview` pushes the in-flight
 * polygon to `useLiveNodeOverrides` so the ceiling mesh rebuilds at
 * pointer rate; `onPolygonChange` is the single commit on release.
 */
export declare const CeilingBoundaryEditor: React.FC<{
    ceilingId: CeilingNode['id'];
}>;
export default CeilingBoundaryEditor;
//# sourceMappingURL=boundary-editor.d.ts.map