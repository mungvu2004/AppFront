import type { ChimneyMaterialRole, ChimneyNode, MaterialSchema, PaintCapability } from '@pascal-app/core';
/**
 * Resolve a chimney face click to its logical surface role.
 *
 * `holes.ts:partitionTopFaceGroups` partitions the chimney body
 * mesh's material slots so:
 *   0 = body
 *   1 = top (the cap face)
 * Faces outside any group (cricket mesh, which renders with a single
 * material) fall back to 'body'.
 */
export declare function resolveChimneyRole(materialIndex: number | null): ChimneyMaterialRole;
export declare function buildChimneyMaterialPatch(role: ChimneyMaterialRole, material: MaterialSchema | undefined, materialPreset: string | undefined): Partial<ChimneyNode>;
export declare function getEffectiveChimneyMaterial(node: ChimneyNode, role: ChimneyMaterialRole): {
    material: MaterialSchema | undefined;
    materialPreset: string | undefined;
};
/**
 * Capability binding for the chimney kind. The editor's
 * selection-manager invokes these in place of the legacy
 * `if (node.type === 'chimney') { ... }` arm.
 */
export declare const chimneyPaint: PaintCapability;
//# sourceMappingURL=paint.d.ts.map