import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
/**
 * Child ids the sidebar tree renders under a node: the kind's
 * `def.tree.childIds` override when declared, otherwise the node's own
 * `children`. Kind-agnostic — kinds that reshape their subtree (hidden
 * derived nodes, flattened containers) do so via the registry hook.
 */
export declare function resolveTreeChildIds(nodeId: AnyNodeId, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): AnyNodeId[];
/**
 * Whether `targetId` appears anywhere under `nodeId` in the *rendered*
 * sidebar tree (i.e. walking registry-overridden child ids, not the raw
 * scene graph). Drives auto-expansion when a descendant gets selected.
 */
export declare function treeContainsDescendant(nodeId: AnyNodeId, targetId: AnyNodeId, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): boolean;
//# sourceMappingURL=tree-structure.d.ts.map