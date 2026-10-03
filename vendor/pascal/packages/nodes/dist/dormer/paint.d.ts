import type { DormerNode, DormerSurfaceMaterialRole, MaterialSchema, PaintCapability } from '@pascal-app/core';
/**
 * Resolve a dormer face click to its logical surface role.
 *
 * The dormer body mesh has 5 material slots (see
 * `csg-geometry.ts:generateDormerGeometry`):
 *   0 = wall (rectangular wall)
 *   1 = side (deck along the slope)
 *   2 = interior — paint as wall
 *   3 = top   (roof shingle)
 *   4 = gable triangle — paint as wall
 *
 * Window-frame meshes are not in the body mesh; they're routed to
 * 'side' separately by the editor when the click lands on them.
 */
export declare function resolveDormerRole(materialIndex: number | null): DormerSurfaceMaterialRole;
export declare function buildDormerMaterialPatch(role: DormerSurfaceMaterialRole, material: MaterialSchema | undefined, materialPreset: string | undefined): Partial<DormerNode>;
/**
 * Capability binding for the dormer kind. The editor's
 * selection-manager invokes these in place of the legacy
 * `if (node.type === 'dormer') { ... }` arm.
 */
export declare const dormerPaint: PaintCapability;
//# sourceMappingURL=paint.d.ts.map