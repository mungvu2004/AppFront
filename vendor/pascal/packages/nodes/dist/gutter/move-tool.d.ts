import { type GutterNode } from '@pascal-app/core';
/**
 * Gutter move tool. Mirrors the ridge-vent move flow — ghost follows
 * the cursor over any roof segment, click commits the new position +
 * parent segment in one undoable step. The eave-snap math from the
 * placement tool runs again on the new segment so the gutter lands on
 * the correct side of the new ridge.
 *
 * On commit the gutter rotation may flip from 0 ↔ π if the user moves
 * it from the front eave to the back eave (or vice versa). The
 * pre-drag rotation is restored on cancel.
 *
 * Ghost transform: mirrors the GutterRenderer chain (roof → segment →
 * snap), so the cursor preview lands at the exact world coords the
 * commit will store. GutterPreview applies no internal rotation, so
 * the gutter's CURRENT `rotation` doesn't bleed into the new snap.
 */
export default function MoveGutterTool({ node }: {
    node: GutterNode;
}): import("react").JSX.Element | null;
//# sourceMappingURL=move-tool.d.ts.map