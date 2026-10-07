import type { SlotDeclaration } from '@pascal-app/core';
import type { FenceNode } from './schema';
export type FenceSlotId = 'posts' | 'infill' | 'base' | 'rail';
export declare const FENCE_POSTS_SLOT_DEFAULT = "library:preset-charcoal";
export declare const FENCE_INFILL_SLOT_DEFAULT = "library:preset-charcoal";
export declare const FENCE_BASE_SLOT_DEFAULT = "library:preset-greige";
export declare const FENCE_RAIL_SLOT_DEFAULT = "library:preset-greige";
export declare const FENCE_SLOT_DEFAULTS: Record<FenceSlotId, string>;
export declare function fenceSlots(node: FenceNode): SlotDeclaration[];
//# sourceMappingURL=slots.d.ts.map