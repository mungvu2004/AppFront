import { type GutterNode } from '@pascal-app/core';
/**
 * Gutter renderer. Mounts at the eave of the host roof-segment — the
 * gutter hangs level off the eave line (gravity wins; no slope tilt).
 * Transform stack:
 *
 *   segment.position → segment.rotation (Y) → gutter.position
 *     → gutter.rotation (Y) → mesh
 *
 * The registered ref sits on the inner group that applies position +
 * rotation, so `NodeArrowHandles` reads gutter-mesh-local coords for
 * its chevron placements (same pattern as ridge-vent).
 *
 * `useLiveNodeOverrides` merges in-flight handle drags onto the store
 * node so the mesh tracks the drag without flushing zustand each
 * frame.
 */
declare const GutterRenderer: ({ node: storeNode }: {
    node: GutterNode;
}) => import("react").JSX.Element | null;
export default GutterRenderer;
//# sourceMappingURL=renderer.d.ts.map