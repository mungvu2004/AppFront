import { type AnyNodeId } from '@pascal-app/core';
interface RegistryTreeNodeProps {
    nodeId: AnyNodeId;
    depth: number;
    isLast?: boolean;
}
/**
 * Generic, registry-driven tree-node row powered by `def.presentation` and
 * `def.tree`. Replaces the per-kind boilerplate
 * components that differed only in their default name and icon — today the
 * roof vents plus cabinet rows. Register a kind in `treeNodeByType` against
 * this component instead of authoring another copy.
 */
export declare const RegistryTreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast, }: RegistryTreeNodeProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=registry-tree-node.d.ts.map