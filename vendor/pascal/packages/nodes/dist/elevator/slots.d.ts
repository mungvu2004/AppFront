import { type ElevatorNode, type SlotDeclaration } from '@pascal-app/core';
export type ElevatorSlotId = 'cab' | 'doors' | 'shaft' | 'glass';
export declare const ELEVATOR_CAB_SLOT_DEFAULT = "library:preset-softwhite";
export declare const ELEVATOR_DOORS_SLOT_DEFAULT = "library:metal-steel";
export declare const ELEVATOR_SHAFT_SLOT_DEFAULT = "library:preset-lightgrey";
export declare const ELEVATOR_GLASS_SLOT_DEFAULT = "library:preset-glass";
export declare function elevatorSlots(node: ElevatorNode): SlotDeclaration[];
//# sourceMappingURL=slots.d.ts.map