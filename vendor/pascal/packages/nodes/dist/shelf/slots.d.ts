import type { SlotDeclaration } from '@pascal-app/core';
import type { ShelfNode } from './schema';
export type ShelfSlotId = 'shelves' | 'frame' | 'back';
export declare const SHELF_SLOT_DEFAULT_COLOR = "#ffffff";
/** Map a builder mesh name to its slot id (null = not a paintable shelf part). */
export declare function shelfSlotIdForMeshName(name: string): ShelfSlotId | null;
/** Which slots a given shelf actually exposes (depends on style/flags). */
export declare function shelfSlots(node: ShelfNode): SlotDeclaration[];
//# sourceMappingURL=slots.d.ts.map