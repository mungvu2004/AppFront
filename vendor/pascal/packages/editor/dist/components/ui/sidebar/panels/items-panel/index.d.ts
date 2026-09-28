import type { AssetInput } from '@pascal-app/core';
import { type FunctionTreeNode } from './function-tree-panel';
export declare function ItemsPanel({ items, onSearchChange, searchResults, leadingTile, emptyState, functionTree, showSourceFilter, showTagFilters, }: {
    items?: AssetInput[];
    /** Called when the search query changes (community edition uses this for server-side search) */
    onSearchChange?: (query: string) => void;
    /** When non-null and search is active, these results bypass local filtering (server search results) */
    searchResults?: AssetInput[] | null;
    /**
     * Optional node rendered as the first grid cell, always visible. Used by the
     * community edition to inject a "+ Generate with AI" tile.
     */
    leadingTile?: React.ReactNode;
    /**
     * Optional node rendered when the grid has no items to show (empty category
     * or no search results). Replaces the default "No results" message.
     */
    emptyState?: React.ReactNode;
    /**
     * DB-driven function taxonomy. When provided, the panel renders the
     * hierarchical tree browse instead of the legacy hardcoded category tabs.
     */
    functionTree?: FunctionTreeNode[];
    /**
     * Library/Community/Mine source chips. The open-source editor has no
     * uploaded items (only the built-in catalog), so it hides these.
     */
    showSourceFilter?: boolean;
    /**
     * Placement/functional tag filter chips under the search row. The
     * open-source editor hides these to keep the panel to plain categories.
     */
    showTagFilters?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map