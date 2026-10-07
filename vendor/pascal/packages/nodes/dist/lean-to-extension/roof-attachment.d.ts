import { type AnyNode, type AnyNodeId, type LeanToExtensionNode, type LeanToRoofEdge, type RoofNode, type RoofSegmentNode, type WallNode } from '@pascal-app/core';
export type LeanToRoofAttachment = {
    roofId: RoofNode['id'];
    roofSegmentId: RoofSegmentNode['id'];
    edge: LeanToRoofEdge;
    edgeRange: readonly [number, number];
    highEdgeHeight: number;
    planDistance: number;
    overlap: number;
    edgeSpan: number;
    wallLocalCenterX: number;
    deckThickness: number;
    shingleThickness: number;
};
type ResolveOptions = {
    roofSegmentId?: string;
    edge?: LeanToRoofEdge;
};
export declare function resolveLeanToRoofAttachment(leanTo: LeanToExtensionNode, wall: WallNode, nodes: Record<AnyNodeId, AnyNode>, options?: ResolveOptions): LeanToRoofAttachment | null;
export declare function applyLeanToRoofAttachment(leanTo: LeanToExtensionNode, attachment: LeanToRoofAttachment): LeanToExtensionNode;
export declare function applyLeanToWallAutoSpan(leanTo: LeanToExtensionNode, wall: WallNode): LeanToExtensionNode;
export declare function applyLeanToWallCornerSpan(leanTo: LeanToExtensionNode, wall: WallNode): LeanToExtensionNode;
export declare function applyLeanToAvailableWallSpan(leanTo: LeanToExtensionNode, wall: WallNode, nodes: Record<AnyNodeId, AnyNode>, targetWallX: number): LeanToExtensionNode;
export declare function detachLeanToFromRoof(leanTo: LeanToExtensionNode): LeanToExtensionNode;
export declare function clearLeanToRoofAttachment(leanTo: LeanToExtensionNode): LeanToExtensionNode;
export declare function resolveLeanToHostRoof(leanTo: LeanToExtensionNode, nodes: Record<AnyNodeId, AnyNode>): RoofNode | undefined;
export {};
//# sourceMappingURL=roof-attachment.d.ts.map