import { type AnyNode, type RoofNode } from '@pascal-app/core';
import type * as THREE from 'three';
import { type ColorPreset, type RenderShading } from '../../lib/materials';
export type RoofMaterialArray = [THREE.Material, THREE.Material, THREE.Material, THREE.Material];
/**
 * The cladding the walls under a roof declare through their ASSEMBLIES
 * (`wall.assembly.exterior.finish` → catalog ref), so the roof's gable band —
 * the triangle of wall above the plate that the roof kind builds — is skinned
 * like the walls it sits on instead of the bare drywall default. The most
 * common ref among the level's walls wins; null when none declares one.
 */
export declare function levelWallCladdingRef(nodes: Readonly<Record<string, AnyNode | undefined>>, roof: Pick<RoofNode, 'parentId'>): string | null;
export declare function getRoofMaterialArray(node: RoofNode, shading?: RenderShading, textures?: boolean, colorPreset?: ColorPreset, sceneTheme?: string, 
/** Catalog ref for the gable/trim band when unpainted — see `levelWallCladdingRef`. */
wallCladdingRef?: string | null): RoofMaterialArray | null;
//# sourceMappingURL=roof-materials.d.ts.map