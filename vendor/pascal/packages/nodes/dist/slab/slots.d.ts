import type { SlotDeclaration } from '@pascal-app/core';
export type SlabSlotId = 'surface' | 'side';
export declare const SLAB_TOP_SLOT_DEFAULT = "library:wood-woodplank48";
export declare const SLAB_SIDE_SLOT_DEFAULT = "#cccccc";
/**
 * A slab exposes two paintable faces: the top floor surface and its sides
 * (vertical walls + underside).
 */
export declare function slabSlots(): SlotDeclaration[];
//# sourceMappingURL=slots.d.ts.map