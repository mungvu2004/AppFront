import type { SlotDeclaration } from '@pascal-app/core';
export type DoorSlotId = 'panel' | 'frame' | 'glass' | 'hardware';
/**
 * A door exposes four paintable slots: `panel` (leaf faces), `frame`, `glass`,
 * and `hardware` (handle / hinges / closer / panic bar). The opening reveal
 * keeps its own material.
 */
export declare function doorSlots(): SlotDeclaration[];
//# sourceMappingURL=slots.d.ts.map