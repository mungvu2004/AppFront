import { type AnyNodeId } from '@pascal-app/core';
interface DormerTreeNodeProps {
    nodeId: AnyNodeId;
    depth: number;
    isLast?: boolean;
}
/**
 * Sidebar tree-node entry for a dormer. Mirrors `ChimneyTreeNode`
 * exactly — dormers are leaf entries (no children) parented under
 * their host roof segment. The `roof.png` icon matches the rest of
 * the roof-accessory kinds.
 */
export declare const DormerTreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast, }: DormerTreeNodeProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=dormer-tree-node.d.ts.map