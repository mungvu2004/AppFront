import { type RidgeVentNode } from '@pascal-app/core';
/**
 * Ridge vent renderer. Sits along the ridge of a roof-segment — no
 * slope tilt is needed (the ridge IS the high line of the segment), so
 * the transform stack is simply
 *
 *   segment.position → segment.rotation (Y) → vent.position
 *     → vent.rotation (Y) → mesh
 *
 * Mirrors the box-vent renderer otherwise (segment lookup via
 * useScene, live-transform follow for parent drags). Style-specific
 * default materials let unpainted ridge vents read as their material
 * family (matte standard / shingled grey / brushed metal) before the
 * user opens the paint tray.
 */
declare const RidgeVentRenderer: ({ node: storeNode }: {
    node: RidgeVentNode;
}) => import("react").JSX.Element | null;
export default RidgeVentRenderer;
//# sourceMappingURL=renderer.d.ts.map