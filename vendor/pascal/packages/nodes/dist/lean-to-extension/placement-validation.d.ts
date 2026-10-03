import { type AnyNode, type AnyNodeId, type LeanToExtensionNode, type WallNode } from '@pascal-app/core';
export declare function resolveLeanToEndAbutments(leanTo: LeanToExtensionNode, wall: WallNode, nodes: Record<AnyNodeId, AnyNode>): LeanToExtensionNode;
export declare function leanToPlacementConflicts(leanTo: LeanToExtensionNode, wall: WallNode, nodes: Record<AnyNodeId, AnyNode>): string[];
//# sourceMappingURL=placement-validation.d.ts.map