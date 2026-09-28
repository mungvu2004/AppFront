import type { TurbineVentNode } from './schema';
/**
 * Translucent ghost of a turbine vent, used by the placement tool's
 * cursor and the move-tool preview. Builds the combined (non-spinning)
 * geometry through the shared pure builder so the ghost shape stays in
 * lockstep with the committed vent. Raycast is disabled so the preview
 * doesn't intercept the cursor ray feeding the placement tool.
 */
declare const TurbineVentPreview: ({ node, invalid }: {
    node: TurbineVentNode;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default TurbineVentPreview;
//# sourceMappingURL=preview.d.ts.map