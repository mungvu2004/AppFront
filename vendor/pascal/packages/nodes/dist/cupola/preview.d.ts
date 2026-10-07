import type { CupolaNode } from './schema';
/**
 * Translucent ghost of a cupola, used by the placement tool's cursor and
 * the move-tool preview. Builds geometry through the shared pure builder so
 * the ghost stays in lockstep with the committed cupola. Raycast disabled
 * so the preview doesn't intercept the cursor ray feeding the tool.
 */
declare const CupolaPreview: ({ node, invalid }: {
    node: CupolaNode;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default CupolaPreview;
//# sourceMappingURL=preview.d.ts.map