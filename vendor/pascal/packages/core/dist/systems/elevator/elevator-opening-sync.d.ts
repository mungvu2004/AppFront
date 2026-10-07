import type { AnyNode, AnyNodeId, CeilingNode, SlabNode } from '../../schema/index.js';
export declare function syncAutoElevatorOpenings(nodes: Record<string, AnyNode>): {
    id: AnyNodeId;
    data: Partial<SlabNode | CeilingNode>;
}[];
//# sourceMappingURL=elevator-opening-sync.d.ts.map