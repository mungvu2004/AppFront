import { type MaterialPresetPayload } from './schema/material.js';
export type MaterialSource = 'pascal' | 'community' | 'mine' | 'workspace';
export type MaterialCatalogItem = {
    id: string;
    label: string;
    category: MaterialCategory;
    /** Origin of the entry. Absent = 'pascal' (all static catalog entries). */
    source?: MaterialSource;
    /**
     * Where this finish is appropriate. Absent = universal (e.g. flat colors).
     * The paint picker may filter by the slot being painted; v1 shows everything.
     */
    surfaces?: MaterialSurface[];
    description?: string;
    previewThumbnailUrl?: string;
    previewColor?: string;
    preset: MaterialPresetPayload;
};
export declare const MATERIAL_CATEGORIES: readonly ["colors", "wood", "stone", "brick", "tile", "wallpaper", "concrete", "metal", "plastic", "fabric", "carpet", "leather", "roofing", "ground", "glass", "other"];
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export declare const MATERIAL_SURFACES: readonly ["floor", "wall", "ceiling", "roof", "furniture", "outdoor"];
export type MaterialSurface = (typeof MATERIAL_SURFACES)[number];
export declare const MATERIAL_CATALOG: MaterialCatalogItem[];
export declare function registerLibraryMaterials(items: MaterialCatalogItem[]): void;
export declare function unregisterLibraryMaterials(ids: string[]): void;
export declare function getDynamicLibraryMaterials(): MaterialCatalogItem[];
export declare function subscribeLibraryMaterials(listener: () => void): () => void;
export declare function getLibraryMaterialsVersion(): number;
export declare function getMaterialsForCategory(category: MaterialCategory): MaterialCatalogItem[];
export declare function getCatalogMaterialById(id?: string): MaterialCatalogItem | undefined;
export declare const LIBRARY_MATERIAL_REF_PREFIX = "library:";
export declare const SCENE_MATERIAL_REF_PREFIX = "scene:";
export declare function toLibraryMaterialRef(id: string): string;
export declare function toSceneMaterialRef(id: string): string;
export declare function getLibraryMaterialIdFromRef(materialRef?: string | null): string | null;
export declare function getSceneMaterialIdFromRef(materialRef?: string | null): string | null;
export type MaterialRef = string;
export type ParsedMaterialRef = {
    kind: 'library';
    id: string;
} | {
    kind: 'scene';
    id: string;
};
export declare function parseMaterialRef(ref?: string | null): ParsedMaterialRef | null;
export declare function getMaterialPresetByRef(materialRef?: string | null): MaterialPresetPayload | null;
//# sourceMappingURL=material-library.d.ts.map