import type { AssetInput } from '@pascal-app/core';
/** A function-axis taxonomy node, assembled into a tree by the embedder. */
export type FunctionTreeNode = {
    slug: string;
    name: string;
    iconUrl?: string | null;
    children: FunctionTreeNode[];
};
/**
 * DB-driven hierarchical Items browse. Roots render as the category tab bar;
 * a selected root with children exposes those children as a secondary chip
 * row. Selecting any node shows items tagged with that node or any descendant.
 * Library / Community / Mine narrows by source on top of the tree selection.
 */
export declare function FunctionTreePanel({ functionTree, items, onSearchChange, searchResults, leadingTile, emptyState, }: {
    functionTree: FunctionTreeNode[];
    items?: AssetInput[];
    onSearchChange?: (query: string) => void;
    searchResults?: AssetInput[] | null;
    leadingTile?: React.ReactNode;
    emptyState?: React.ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=function-tree-panel.d.ts.map