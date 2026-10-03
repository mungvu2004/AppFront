import type { EyebrowVentNode } from './schema';
/**
 * Translucent ghost of an eyebrow vent, used by the placement tool's cursor
 * and the move-tool preview. Builds geometry through the shared pure builder
 * so the ghost stays in lockstep with the committed vent. Raycast disabled so
 * the preview doesn't intercept the cursor ray feeding the tool.
 */
declare const EyebrowVentPreview: ({ node, invalid }: {
    node: EyebrowVentNode;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default EyebrowVentPreview;
//# sourceMappingURL=preview.d.ts.map