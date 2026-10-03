import type { AnyNode, AnyNodeId, CeilingNode, SlabNode } from '../../schema/index.js';
export declare function syncAutoStairOpenings(nodes: Record<string, AnyNode>): {
    id: AnyNodeId;
    data: Partial<SlabNode | CeilingNode>;
}[];
//# sourceMappingURL=stair-opening-sync.d.ts.map