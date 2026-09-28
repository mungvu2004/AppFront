import { type DormerNode, type RoofNode, type RoofSegmentNode } from '@pascal-app/core';
/**
 * Position section: X, Z (world-space) and Rotation (world-space)
 * sliders. Owns the read side of the dormer's world transform —
 * confined to a single useMemo so the underlying `updateWorldMatrix`
 * calls don't fire on unrelated re-renders. Also owns the segment-
 * local commits, including the cross-segment reparent case.
 */
export declare function DormerPositionSection({ node, segment, roof, selectedId, previewProp, commitProp, }: {
    node: DormerNode;
    segment: RoofSegmentNode | undefined;
    roof: RoofNode | undefined;
    selectedId: string;
    previewProp: (updates: Partial<DormerNode>) => void;
    commitProp: (updates: Partial<DormerNode>) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=panel-position-section.d.ts.map