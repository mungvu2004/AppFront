import { type SolarPanelNode } from '@pascal-app/core';
/**
 * Solar panel renderer. The panel's Y and surface tilt are derived
 * live from the parent roof-segment's finished (deck + shingle) surface
 * on every render via `getRoofOuterSurfaceFrameAtPoint` — the same
 * authoritative helper skylights use. Deriving rather than reading the
 * stored `position[1]`/`surfaceNormal` snapshot is what lets the panel
 * re-seat and re-tilt automatically when the roof's wall height or
 * pitch changes; a cached snapshot would leave it floating or buried.
 *
 * The segment's live overrides are merged too, so the panel tracks the
 * surface continuously during a wall-height/pitch drag, not just after
 * the value commits to the scene store.
 *
 * The surface orientation is applied as a quaternion on an inner
 * group computed once per render (not per frame). This matches the
 * static-transform pattern used by the other roof accessories and
 * gives up the legacy `useFrame` quaternion smoothing — segment yaw
 * changes still propagate immediately through the outer `rotation-y`
 * binding.
 */
declare const SolarPanelRenderer: ({ node: storeNode }: {
    node: SolarPanelNode;
}) => import("react").JSX.Element | null;
export default SolarPanelRenderer;
//# sourceMappingURL=renderer.d.ts.map