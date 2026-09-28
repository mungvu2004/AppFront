import { type AnyNodeId, type DoorInteractiveState, isOperationDoorType } from '@pascal-app/core';
export declare const DOOR_SWING_OPEN_ANGLE: number;
export declare const DOOR_TOGGLE_ANIMATION_MS = 520;
export { isOperationDoorType };
type DoorOpenAnimationOptions = {
    persist?: boolean;
};
export declare function getDisplayedDoorValue(doorId: AnyNodeId, field: keyof DoorInteractiveState, nodeValue: number | undefined): number;
export declare function toggleDoorOpenState(doorId: AnyNodeId, options?: DoorOpenAnimationOptions): void;
export declare function closeDoorOpenState(doorId: AnyNodeId, options?: DoorOpenAnimationOptions): void;
//# sourceMappingURL=door-interaction.d.ts.map