import type { SlabNode } from '../../schema/index.js';
/**
 * Translate a solid slab's authored vertical interval onto a chosen base plane.
 *
 * `slab.elevation` is the authored top relative to the placement plane and
 * `thickness` grows downward. Adding the base therefore preserves both the
 * thickness and any intentional clearance in a preset. Recessed slabs keep
 * their level-relative depth because their rim is defined by the level plane.
 */
export declare function resolveSlabPlacementElevation(slab: Pick<SlabNode, 'elevation' | 'recessed'>, baseElevation: number | null | undefined): number;
//# sourceMappingURL=slab-placement.d.ts.map