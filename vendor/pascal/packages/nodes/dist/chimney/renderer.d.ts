import { type ChimneyNode } from '@pascal-app/core';
/**
 * Chimney renderer. Reads the parent roof-segment so the body height
 * is derived from `segment.wallHeight + roofHeight + node.heightAboveRidge`.
 *
 * **Option C scope**: chimney is rendered as solid geometry that
 * intersects the roof at the deck line. The decorative CSG-driven
 * features (cap flue holes, body cavity, panels, bands) are not
 * rendered in this port — they remain as no-op fields in the schema
 * until the roof-segment Stage B migration introduces a `roofCutout`
 * capability the parent can read.
 */
declare const ChimneyRenderer: ({ node: storeNode }: {
    node: ChimneyNode;
}) => import("react").JSX.Element | null;
export default ChimneyRenderer;
//# sourceMappingURL=renderer.d.ts.map