import { type CupolaNode } from '@pascal-app/core';
/**
 * Cupola renderer. Same transform stack as the box vent — the cupola is
 * parented to a roof-segment, so this reads the segment directly and
 * reproduces the segment-local transform (segment position → rotation →
 * cupola position → slope tilt → cupola yaw → mesh). No animation.
 */
declare const CupolaRenderer: ({ node: storeNode }: {
    node: CupolaNode;
}) => import("react").JSX.Element | null;
export default CupolaRenderer;
//# sourceMappingURL=renderer.d.ts.map