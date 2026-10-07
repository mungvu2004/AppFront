import { type EyebrowVentNode } from '@pascal-app/core';
/**
 * Eyebrow-vent renderer. Same transform stack as the box vent / cupola — the
 * vent is parented to a roof-segment, so this reads the segment directly and
 * reproduces the segment-local transform (segment position → rotation → vent
 * position → slope tilt → vent yaw → mesh). No animation.
 */
declare const EyebrowVentRenderer: ({ node: storeNode }: {
    node: EyebrowVentNode;
}) => import("react").JSX.Element | null;
export default EyebrowVentRenderer;
//# sourceMappingURL=renderer.d.ts.map