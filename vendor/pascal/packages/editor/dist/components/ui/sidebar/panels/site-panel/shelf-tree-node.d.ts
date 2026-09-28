import { type ShelfNode } from '@pascal-app/core';
interface ShelfTreeNodeProps {
    nodeId: ShelfNode['id'];
    depth: number;
    isLast?: boolean;
}
/**
 * Sidebar tree entry for shelf. Mirrors `item-tree-node`'s shape so the
 * shelf's hosted items list as collapsible children — same pattern items
 * use for their nested items. The shelf has its own `children: string[]`
 * field on the schema; items reparent into it via `def.surfaces` + the
 * placement coordinator's shelf strategy.
 */
export declare const ShelfTreeNode: import("react").MemoExoticComponent<({ nodeId, depth, isLast, }: ShelfTreeNodeProps) => import("react").JSX.Element>;
export {};
//# sourceMappingURL=shelf-tree-node.d.ts.map