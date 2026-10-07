import type { AnyNode, AnyNodeId, FloorPlacedFootprint, StairNode, StairSegmentNode } from '@pascal-app/core';
type SegmentTransform = {
    position: [number, number, number];
    rotation: number;
};
export declare function getStairFloorPlacedFootprints(stair: StairNode, nodes: Readonly<Record<AnyNodeId, AnyNode>>): FloorPlacedFootprint[];
export declare function getStairSegmentFloorPlacedFootprints(stair: StairNode, segments: readonly StairSegmentNode[]): FloorPlacedFootprint[];
export declare function computeStairSegmentFloorStackTransforms(segments: readonly StairSegmentNode[]): SegmentTransform[];
export {};
//# sourceMappingURL=floor-stack.d.ts.map