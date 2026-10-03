import { type AnyNode, type AnyNodeId, type CeilingNode, type ChimneyMaterialRole, type ChimneyNode, type ColumnNode, type DormerSurfaceMaterialRole, type FenceNode, type MaterialSchema, type MaterialTarget, type RoofNode, type RoofSegmentNode, type RoofSegmentSurfaceMaterialRole, type RoofSurfaceMaterialRole, type ShelfNode, type SlabNode, type StairNode, type StairSurfaceMaterialRole, type WallSurfaceSide } from '@pascal-app/core';
export type PaintableMaterialTarget = Extract<MaterialTarget, 'wall' | 'roof' | 'stair' | 'fence' | 'column' | 'slab' | 'ceiling' | 'shelf' | 'cabinet' | 'chimney' | 'dormer' | 'box-vent' | 'ridge-vent' | 'turbine-vent' | 'cupola' | 'eyebrow-vent' | 'gutter' | 'downspout'> | 'item';
export type SingleSurfaceMaterialRole = 'surface';
export type ActivePaintMaterial = {
    material?: MaterialSchema;
    materialPreset?: string;
    sourceTarget: PaintableMaterialTarget;
};
export declare function hasActivePaintMaterial(material: ActivePaintMaterial | null | undefined): material is ActivePaintMaterial;
export declare function getActivePaintMaterialLabel(material: ActivePaintMaterial | null | undefined): string;
export declare function buildRoofSurfaceMaterialPatch(node: RoofNode, targetRole: RoofSurfaceMaterialRole, material: MaterialSchema | undefined, materialPreset: string | undefined): Partial<RoofNode>;
/**
 * Build a per-segment paint patch for one of the three surface roles. The
 * segment ends up with role-specific fields set (and the legacy catch-all
 * `material` cleared) so subsequent reads pick the role override over any
 * parent-roof fallback.
 */
export declare function buildRoofSegmentSurfaceMaterialPatch(node: RoofSegmentNode, targetRole: RoofSegmentSurfaceMaterialRole, material: MaterialSchema | undefined, materialPreset: string | undefined): Partial<RoofSegmentNode>;
/**
 * Clear every painted material on a node back to its default. Works for any
 * kind without per-type knowledge: it nulls the catch-all `material` /
 * `materialPreset` plus any role field (`*Material` / `*MaterialPreset`) that
 * the node actually carries. For a roof it also resets every child segment, so
 * a single call defaults the whole roof system. `updateNode` merges patches
 * shallowly without re-validation, so the `undefined` values land as cleared
 * fields and the renderer falls back to the theme defaults.
 */
export declare function buildResetSurfaceMaterialUpdates(nodes: Record<string, AnyNode>, node: AnyNode): {
    id: AnyNodeId;
    data: Partial<AnyNode>;
}[];
export declare function buildStairSurfaceMaterialPatch(node: StairNode, targetRole: StairSurfaceMaterialRole, material: MaterialSchema | undefined, materialPreset: string | undefined): Partial<StairNode>;
export declare function buildSingleSurfaceMaterialPatch<TNode extends FenceNode | ColumnNode | SlabNode | CeilingNode | ShelfNode>(material: MaterialSchema | undefined, materialPreset: string | undefined): Partial<TNode>;
export declare function getEffectiveChimneyMaterial(node: ChimneyNode, role: ChimneyMaterialRole): {
    material: MaterialSchema | undefined;
    materialPreset: string | undefined;
};
export declare function resolveActivePaintMaterialFromSelection(params: {
    nodes: Record<string, any>;
    selectedId: string | null;
    selectedMaterialTarget: {
        nodeId: string;
        role: WallSurfaceSide | StairSurfaceMaterialRole | RoofSurfaceMaterialRole | ChimneyMaterialRole | DormerSurfaceMaterialRole | SingleSurfaceMaterialRole | string;
    } | null;
}): ActivePaintMaterial | null;
export declare function resolvePaintTargetFromSelection(params: {
    nodes: Record<string, any>;
    selectedId: string | null;
}): PaintableMaterialTarget | null;
//# sourceMappingURL=material-paint.d.ts.map