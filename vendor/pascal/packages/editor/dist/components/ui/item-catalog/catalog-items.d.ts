import type { AssetInput } from '@pascal-app/core';
/**
 * A catalog tile: the asset plus optional editor placement metadata.
 * `tool` names the placement tool the tile arms (defaults to the generic
 * `'item'` drop tool) — kinds drawn by their own registry tool (e.g. the
 * modular cabinet) point at that tool id instead.
 */
export type CatalogItem = AssetInput & {
    tool?: string;
};
export declare const CATALOG_ITEMS: CatalogItem[];
export declare function getDefaultCatalogItem(category: string | null | undefined): AssetInput | null;
//# sourceMappingURL=catalog-items.d.ts.map