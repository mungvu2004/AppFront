import type { AnyNode, AnyNodeId, ColumnNode, LeanToExtensionNode } from '@pascal-app/core';
import type { LeanToPostSide } from '../lean-to-extension/assembly';
export declare function isLeanToPostOmitted(leanTo: LeanToExtensionNode, side: LeanToPostSide, index: number): boolean;
export declare function leanToPostOmissionPatchesOnDelete(column: ColumnNode, nodes: Record<AnyNodeId, AnyNode>): Array<{
    id: AnyNodeId;
    data: Partial<AnyNode>;
}>;
//# sourceMappingURL=lean-to-post-omissions.d.ts.map