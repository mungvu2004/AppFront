import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
export type SystemFinding = {
    code: string;
    message: string;
    nodeIds: AnyNodeId[];
    severity: 'error' | 'warning';
};
export declare function checkDistributionSystems(nodes: Record<AnyNodeId, AnyNode>): SystemFinding[];
//# sourceMappingURL=system-checks.d.ts.map