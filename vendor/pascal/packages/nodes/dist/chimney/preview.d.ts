import { type ChimneyNode, type RoofSegmentNode } from '@pascal-app/core';
/**
 * The preview needs a segment fixture to build the body height. The
 * placement tool passes the segment under the cursor; when floating
 * (off-roof fallback), segment is absent — build against RoofSegmentNode
 * defaults so the ghost renders flat at the grid position with yaw 0.
 */
declare const ChimneyPreview: ({ node, segment, invalid, }: {
    node: ChimneyNode;
    segment?: RoofSegmentNode;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default ChimneyPreview;
//# sourceMappingURL=preview.d.ts.map