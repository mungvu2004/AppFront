import type { SlotDeclaration } from '@pascal-app/core';
import type { ColumnNode } from './schema';
export type ColumnSlotId = 'shaft' | 'base' | 'capital' | 'frame';
export declare const COLUMN_SHAFT_DEFAULT = "library:concrete-plaster";
export declare const COLUMN_BASE_DEFAULT = "library:concrete-plaster";
export declare const COLUMN_CAPITAL_DEFAULT = "library:concrete-plaster";
export declare const COLUMN_FRAME_DEFAULT = "library:metal-steel";
export declare function columnSlots(node: ColumnNode): SlotDeclaration[];
//# sourceMappingURL=slots.d.ts.map