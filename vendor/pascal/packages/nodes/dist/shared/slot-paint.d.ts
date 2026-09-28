import { type AnyNode, type MaterialSchema, type MaterialTarget, type PaintCapability, type PaintPreviewArgs, type PaintResolveArgs, type SceneMaterial, type SceneMaterialId } from '@pascal-app/core';
import { type Material } from 'three';
export declare function isSlotPaintPreviewActive(nodeId: string): boolean;
export declare function subscribeSlotPaintPreviews(listener: (nodeId: string) => void): () => void;
export type SlotPaintMaterialResolution = {
    ref: string | undefined;
    newSceneMaterial: SceneMaterial | null;
};
export declare function resolveSlotPaintMaterialRef(materials: Record<SceneMaterialId, SceneMaterial>, material: MaterialSchema | undefined, materialPreset: string | undefined): SlotPaintMaterialResolution | null;
/** Preview material for a slot paint — mirrors the commit's resolution. */
export declare function buildSlotPreviewMaterial(material: MaterialSchema | undefined, materialPreset: string | undefined): Material | null;
/**
 * Preview for kinds whose meshes are produced by `def.geometry` and tagged
 * with `userData.slotId` (+ `__fromGeometry`). Swaps every builder mesh whose
 * slot matches `role`, leaving hosted-child meshes (which can carry a colliding
 * `userData.slotId` from their own GLB) untouched.
 */
export declare function previewGeometrySlot(args: PaintPreviewArgs): (() => void) | null;
/**
 * Preview for kinds whose meshes are built by a viewer system (window, door)
 * and tagged with `userData.slotId` — no `__fromGeometry` marker and no hosted
 * children to guard against, so it swaps every mesh whose slot matches `role`.
 */
export declare function previewSlotByUserData(args: PaintPreviewArgs): (() => void) | null;
/**
 * Resolve the slot for a kind whose paint hit lands on a proud opening proxy
 * (door/window: a 1m-deep invisible cutout that wins the scene raycast over the
 * wall in front of the recessed body) rather than the part itself. Re-raycasts
 * the kind's OWN registered subtree (ignoring everything else) and returns the
 * first tagged sub-mesh under the cursor; falls back to the direct hit's slot
 * (e.g. a proud part the scene raycast hit directly).
 */
export declare function resolveSlotByReRaycast(args: PaintResolveArgs): string | null;
export type SlotPaintConfig = {
    materialTarget?: MaterialTarget;
    /** Resolve the slot id for a pointer hit (`null` = not paintable here). */
    resolveRole: (args: PaintResolveArgs) => string | null;
    /** Apply a preview to the registered mesh subtree for `role`. */
    applyPreview: (args: PaintPreviewArgs) => (() => void) | null;
    /**
     * Optional legacy fallback for the picker's current-value indicator — read
     * when no `node.slots[role]` ref exists yet (e.g. a scene painted before the
     * kind moved onto the slot model still carries inline `material`/`preset`).
     */
    legacyEffective?: (node: AnyNode, role: string) => {
        material: MaterialSchema | undefined;
        materialPreset: string | undefined;
    } | null;
    /** Opt into the painter's `room` application scope (walls, slabs). */
    roomScope?: boolean;
};
export declare function createSlotPaintCapability(config: SlotPaintConfig): PaintCapability;
//# sourceMappingURL=slot-paint.d.ts.map