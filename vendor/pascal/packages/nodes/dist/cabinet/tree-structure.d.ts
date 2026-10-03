import type { AnyNode, AnyNodeId } from '@pascal-app/core';
/** `def.tree.hidden` for cabinet runs: corner-derived legs disappear as rows
 * (their modules resurface through `childIds` flattening). */
export declare function cabinetTreeHidden(node: AnyNode, _nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): boolean;
export declare function cabinetTreeLabel(node: AnyNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): string;
/** `def.tree.childIds` for both cabinet kinds. */
export declare function cabinetTreeChildIds(node: AnyNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): AnyNodeId[];
export declare function cabinetFloorplanAffectedIds(args: {
    node: AnyNode;
    nodes: Record<AnyNodeId, AnyNode>;
    liveOverrides: Map<string, Record<string, unknown>>;
}): readonly AnyNodeId[];
//# sourceMappingURL=tree-structure.d.ts.map