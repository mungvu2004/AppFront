import type { AnyNode, AnyNodeId, CabinetModuleNode, CabinetNode, NodeQuickAction } from '@pascal-app/core';
export declare function cabinetQuickActions({ node, nodes, }: {
    node: CabinetNode | CabinetModuleNode;
    nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>;
}): NodeQuickAction[];
//# sourceMappingURL=quick-actions.d.ts.map