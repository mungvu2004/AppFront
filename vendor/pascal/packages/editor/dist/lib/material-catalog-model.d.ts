import { type MaterialSource } from '@pascal-app/core';
export type MaterialSourceFilter = MaterialSource;
export declare function useMaterialCatalogModel(selectedMaterialPreset?: string, onSelectMaterialPreset?: (ref: string) => void, disabled?: boolean): {
    selectedCategory: "brick" | "concrete" | "wood" | "glass" | "metal" | "tile" | "stone" | "other" | "ground" | "colors" | "wallpaper" | "plastic" | "fabric" | "carpet" | "leather" | "roofing";
    setSelectedCategory: (category: "brick" | "concrete" | "wood" | "glass" | "metal" | "tile" | "stone" | "other" | "ground" | "colors" | "wallpaper" | "plastic" | "fabric" | "carpet" | "leather" | "roofing") => void;
    sourceFilter: MaterialSource;
    setSourceFilter: import("react").Dispatch<import("react").SetStateAction<MaterialSource>>;
    visibleSourceFilters: {
        id: MaterialSourceFilter;
        label: string;
    }[];
    availableCategories: ("brick" | "concrete" | "wood" | "glass" | "metal" | "tile" | "stone" | "other" | "ground" | "colors" | "wallpaper" | "plastic" | "fabric" | "carpet" | "leather" | "roofing")[];
    catalogItems: import("@pascal-app/core").MaterialCatalogItem[];
    select: (id: string) => void;
};
//# sourceMappingURL=material-catalog-model.d.ts.map