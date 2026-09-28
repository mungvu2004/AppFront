import type { GutterNode } from './schema';
/**
 * Translucent ghost of a gutter — built from the same `buildGutterGeometry`
 * the renderer commits, so the shape on screen during placement is the
 * shape that lands on click.
 *
 * No internal transform wrapper. Callers (placement tool + move tool)
 * mirror the GutterRenderer's transform chain around this component
 * (roof → segment → snap), so the ghost shares one bulletproof chain
 * with the committed mesh instead of a flattened-yaw shortcut that can
 * drift in edge cases.
 *
 * FrontSide matches the renderer; DoubleSide would render the inside
 * of the trough walls and visually thicken the ghost relative to the
 * placed gutter.
 */
declare const GutterPreview: ({ node, invalid }: {
    node: GutterNode;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default GutterPreview;
//# sourceMappingURL=preview.d.ts.map