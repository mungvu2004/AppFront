import { type AnyNodeId, type StairNode, type StairSegmentNode } from '@pascal-app/core';
type DuplicateStairOptions = {
    mode?: 'select' | 'move';
    offset?: [number, number, number];
    parentId?: AnyNodeId;
};
type DuplicateStairResult = {
    stair: StairNode;
    segmentIds: StairSegmentNode['id'][];
};
/**
 * Duplicates a stair through the shared fresh-subtree placement path.
 *
 * The draft passed to the move tool is the exact node stored in the scene,
 * so its geometry, descendants, selection identity, and eventual commit all
 * use one fresh ID graph.
 */
export declare function duplicateStairSubtree(sourceStairId: AnyNodeId, options?: DuplicateStairOptions): DuplicateStairResult;
export {};
//# sourceMappingURL=stair-duplication.d.ts.map