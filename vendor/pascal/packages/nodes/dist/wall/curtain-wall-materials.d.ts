import { type SceneMaterial, type SceneMaterialId, type WallNode } from '@pascal-app/core';
import { getMaterialsForWall, type RenderShading, type WallMaterialOverride, type WallMaterials } from '@pascal-app/viewer';
export declare function createCurtainWallMaterials(wall: WallNode, shading: RenderShading, materials?: Record<SceneMaterialId, SceneMaterial>): WallMaterialOverride;
export declare function getCurtainAwareWallMaterials(wall: WallNode, shading?: RenderShading, textures?: boolean, colorPreset?: Parameters<typeof getMaterialsForWall>[3], sceneTheme?: string, materials?: Record<SceneMaterialId, SceneMaterial>): WallMaterials;
//# sourceMappingURL=curtain-wall-materials.d.ts.map