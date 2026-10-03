import { type AnyNode, type AnyNodeId, LeanToExtensionNode, type RoofSegmentNode } from '@pascal-app/core';
export type ConicalLeanToPlanHost = {
    segment: RoofSegmentNode;
    center: [number, number];
    rotationY: number;
    node: LeanToExtensionNode;
};
export declare function isClosedLoopLeanTo(leanTo: Pick<LeanToExtensionNode, 'hostKind'>): boolean;
export declare function isConicalLeanToHostOccupied(segmentId: RoofSegmentNode['id'], nodes: Record<AnyNodeId, AnyNode>): boolean;
export declare function resolveConicalLeanToPlacement(segment: RoofSegmentNode, source?: Partial<LeanToExtensionNode>): LeanToExtensionNode | null;
export declare function resolveConicalLeanToSurfaceHit(segment: RoofSegmentNode, localPosition: readonly [number, number, number], normal?: readonly [number, number, number]): LeanToExtensionNode | null;
export declare function findConicalLeanToHostInPlan(point: readonly [number, number], nodes: Record<AnyNodeId, AnyNode>, activeLevelId: AnyNodeId, options?: {
    includeOccupied?: boolean;
}): ConicalLeanToPlanHost | null;
//# sourceMappingURL=conical-host.d.ts.map