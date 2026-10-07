import type { AssetInput } from '@pascal-app/core';
import { type CatalogCategory } from './../../../store/use-editor';
export declare function ItemCatalog({ category, items: itemsOverride, activePlacementTag, activeFunctionalTag, search, overrideItems, leadingTile, emptyState, }: {
    category: CatalogCategory;
    items?: AssetInput[];
    activePlacementTag?: string | null;
    activeFunctionalTag?: string | null;
    search?: string;
    /** When set, bypasses all filtering and displays these items directly (used for server search results) */
    overrideItems?: AssetInput[];
    /** Rendered as the first grid cell, always visible when there are items. */
    leadingTile?: React.ReactNode;
    /** Rendered when there are no items to show. Replaces the empty grid. */
    emptyState?: React.ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=item-catalog.d.ts.map