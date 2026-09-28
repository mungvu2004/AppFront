import { type SceneMaterial, type SceneMaterialId, type WallNode } from '@pascal-app/core';
import { type Material } from 'three';
import { type ColorPreset, type RenderShading } from '../../lib/materials';
type SceneMaterials = Record<SceneMaterialId, SceneMaterial> | undefined;
export type WallMaterialArray = Material[];
export interface WallMaterials {
    visible: WallMaterialArray;
    invisible: WallMaterialArray;
    translucent: WallMaterialArray;
    deleteVisible: WallMaterialArray;
    deleteInvisible: WallMaterialArray;
    deleteTranslucent: WallMaterialArray;
    materialHash: string;
    ownedVisible?: Material[];
}
export type WallMaterialOverride = {
    hash: string;
    create: () => {
        visible: WallMaterialArray;
        owned?: Material[];
    };
};
export type WallMaterialsResolver = (wallNode: WallNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string, sceneMaterials?: SceneMaterials) => WallMaterials;
/** Lazy light-emissive selection variant of a wall's material array (keeps texture). */
export declare function getSelectionHighlightMaterials(materials: WallMaterialArray): WallMaterialArray;
/**
 * Softer hover sibling of the selection variant — the affordance for a
 * hovered HIDDEN wall (`WallCutout` applies it to the invisible stipple
 * film so the wall the click would select reads under the cursor).
 */
export declare function getHoverHighlightMaterials(materials: WallMaterialArray): WallMaterialArray;
export declare function getWallMaterialHash(wallNode: WallNode, shading: RenderShading, sceneMaterials?: SceneMaterials, overrideHash?: string): string;
export declare function getMaterialsForWall(wallNode: WallNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string, sceneMaterials?: SceneMaterials, override?: WallMaterialOverride): WallMaterials;
export declare function getVisibleWallMaterials(wallNode: WallNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string, sceneMaterials?: SceneMaterials): WallMaterialArray;
export {};
//# sourceMappingURL=wall-materials.d.ts.map