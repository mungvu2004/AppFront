import type { AnyNode, AnyNodeId, DuctSegmentNode, PipeSegmentNode } from '@pascal-app/core';
type Run = DuctSegmentNode | PipeSegmentNode;
export type FittingDeletionPlan = {
    fittingId: AnyNodeId;
    deleteFitting: boolean;
    cascadeDeleteIds: AnyNodeId[];
    updates: Array<{
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }>;
};
export declare function fittingDeletionPlansForRun(run: Run, nodes: Record<AnyNodeId, AnyNode>, topologyDeleteIds: ReadonlySet<AnyNodeId>, ownerOnly: boolean): FittingDeletionPlan[];
export {};
//# sourceMappingURL=fitting-deletion-cleanup.d.ts.map