import { type DownspoutNode } from '@pascal-app/core';
/**
 * Downspout renderer. Mount chain mirrors the gutter's, then nests
 * one level deeper into the outlet position in gutter-mesh-local:
 *
 *   segment.position → segment.rotation (Y)
 *     → [gutter.position[0], computeEaveY(segment), gutter.position[2]]
 *     → gutter.rotation (Y)
 *     → [outlet.x, outlet.y, outlet.z]
 *     → mesh (pipe descends from Y = 0)
 *
 * Pulling the gutter's eave Y from `computeEaveY(effectiveSegment)`
 * means the downspout follows wallHeight / overhang / pitch changes
 * live, on the same frame as the gutter. The gutter and segment also
 * subscribe to `useLiveNodeOverrides` so drag-in-flight changes flow
 * through too.
 */
declare const DownspoutRenderer: ({ node: storeNode }: {
    node: DownspoutNode;
}) => import("react").JSX.Element | null;
export default DownspoutRenderer;
//# sourceMappingURL=renderer.d.ts.map