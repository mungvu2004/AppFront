import { type SceneMaterial, type SceneMaterialId } from '@pascal-app/core';
import { MeshBasicNodeMaterial } from 'three/webgpu';
export type CeilingMaterials = {
    topMaterial: MeshBasicNodeMaterial;
    bottomMaterial: MeshBasicNodeMaterial;
};
export declare function getCeilingMaterials(color?: string): CeilingMaterials;
/**
 * Resolve a slot `MaterialRef` to a flat colour for the ceiling surface.
 * `library:` refs use the catalog preset's base colour; `scene:` refs use the
 * stored material's colour. Returns null for a dangling / unparseable ref so
 * the caller falls back to its default.
 */
export declare function ceilingColorFromRef(ref: string | undefined, sceneMaterials: Record<SceneMaterialId, SceneMaterial> | undefined): string | null;
//# sourceMappingURL=materials.d.ts.map