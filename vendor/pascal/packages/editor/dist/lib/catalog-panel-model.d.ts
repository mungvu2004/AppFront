import { type CatalogItem } from '../components/ui/item-catalog/catalog-items';
import { type CatalogCategory } from '../store/use-editor';
export declare function filterCatalogItems({ category, items, search, activePlacementTag, activeFunctionalTag, overrideItems, }: {
    category?: CatalogCategory;
    items?: readonly CatalogItem[];
    search?: string;
    activePlacementTag?: string | null;
    activeFunctionalTag?: string | null;
    overrideItems?: readonly CatalogItem[];
}): readonly CatalogItem[];
export declare function activateCatalogItem(item: CatalogItem): void;
export { isCatalogItemSelected } from './catalog-selection';
//# sourceMappingURL=catalog-panel-model.d.ts.map