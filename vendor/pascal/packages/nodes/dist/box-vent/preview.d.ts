import type { BoxVentNode } from './schema';
/**
 * Translucent ghost of a box vent, used by the placement tool's cursor
 * and the move-tool preview. Builds the geometry through the shared
 * pure builder so the ghost shape stays in lockstep with the committed
 * vent.
 *
 * Raycast is disabled on the mesh — the cursor follows the vent, so
 * leaving raycast active would cause the preview itself to intercept
 * the cursor ray and starve the placement tool of `roof:move` events.
 */
declare const BoxVentPreview: ({ node, invalid }: {
    node: BoxVentNode;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default BoxVentPreview;
//# sourceMappingURL=preview.d.ts.map