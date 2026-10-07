export declare const SLOT_MATERIAL_PREFIX = "slot_";
/** A glTF material name marks a paintable slot when it starts with `slot_` (case-insensitive). */
export declare function isSlotMaterialName(name: string): boolean;
/**
 * Derive the stable slot id from a glTF material name:
 * strip the `slot_` prefix (case-insensitive), drop Blender numeric dedupe
 * suffixes like `.001`, lowercase the remainder. Returns null when the name
 * is not a slot material. Used by BOTH the upload scan (later) and the
 * renderer so DB metadata and runtime meshes can never drift.
 */
export declare function deriveSlotId(materialName: string): string | null;
/** slot id -> display label: underscores to spaces, sentence case. e.g. 'bed_frame' -> 'Bed frame'. */
export declare function slotLabelFromId(slotId: string): string;
//# sourceMappingURL=slots.d.ts.map