import type { MotionCommand } from '../procedural-items/motion-controller.js';
import type { Interactive } from '../schema/nodes/item.js';
import type { AnyNodeId } from '../schema/types.js';
export type ControlValue = boolean | number;
export type ItemInteractiveState = {
    controlValues: ControlValue[];
};
export type DoorInteractiveState = {
    operationState?: number;
    swingAngle?: number;
};
export type DoorAnimationState = {
    field: keyof DoorInteractiveState;
    from: number;
    to: number;
    startedAt: number | null;
    durationMs: number;
    persist: boolean;
};
export type WindowInteractiveState = {
    operationState?: number;
};
export type WindowAnimationState = {
    field: keyof WindowInteractiveState;
    from: number;
    to: number;
    startedAt: number | null;
    durationMs: number;
    persist: boolean;
};
export type SkylightInteractiveState = {
    operationState?: number;
};
export type SkylightAnimationState = {
    field: keyof SkylightInteractiveState;
    from: number;
    to: number;
    startedAt: number | null;
    durationMs: number;
    persist: boolean;
};
export type ElevatorPhase = 'idle' | 'closing' | 'moving' | 'opening' | 'open';
export type ElevatorInteractiveState = {
    currentLevelId: AnyNodeId | null;
    targetLevelId: AnyNodeId | null;
    carY: number;
    doorOpen: number;
    phase: ElevatorPhase;
    phaseStartedAt: number | null;
    queue: AnyNodeId[];
    requestedStops: AnyNodeId[];
};
type InteractiveStore = {
    items: Record<AnyNodeId, ItemInteractiveState>;
    doors: Record<AnyNodeId, DoorInteractiveState>;
    doorAnimations: Record<AnyNodeId, DoorAnimationState>;
    windows: Record<AnyNodeId, WindowInteractiveState>;
    windowAnimations: Record<AnyNodeId, WindowAnimationState>;
    skylights: Record<AnyNodeId, SkylightInteractiveState>;
    skylightAnimations: Record<AnyNodeId, SkylightAnimationState>;
    elevators: Record<AnyNodeId, ElevatorInteractiveState>;
    procedural: Record<AnyNodeId, {
        parts: Record<string, boolean>;
        lightsOn: boolean;
        motionCommand?: MotionCommand;
    }>;
    lampDefault: boolean;
    lampItems: Record<AnyNodeId, number[]>;
    setLampDefault: (on: boolean, resetOverrides?: boolean) => void;
    initProcedural: (nodeId: AnyNodeId, partIds: string[], spinPartIds?: string[]) => void;
    toggleProceduralPart: (nodeId: AnyNodeId, partId: string) => void;
    setProceduralParts: (nodeId: AnyNodeId, partIds: string[], on: boolean) => void;
    setProceduralLights: (nodeId: AnyNodeId, on: boolean) => void;
    toggleProceduralLights: (nodeId: AnyNodeId) => void;
    removeProcedural: (nodeId: AnyNodeId) => void;
    /** Initialize a node's interactive state from its asset definition (idempotent) */
    initItem: (itemId: AnyNodeId, interactive: Interactive, nonLightToggleDefault?: boolean) => void;
    toggleItemToggles: (itemId: AnyNodeId, interactive: Interactive) => void;
    /** Set a single control value */
    setControlValue: (itemId: AnyNodeId, index: number, value: ControlValue) => void;
    /** Remove a node's state (e.g. on unmount) */
    removeItem: (itemId: AnyNodeId) => void;
    /** Set transient door open state without committing it to the scene node */
    setDoorOpenState: (doorId: AnyNodeId, value: DoorInteractiveState) => void;
    /** Clear transient door open state */
    removeDoorOpenState: (doorId: AnyNodeId) => void;
    /** Queue a door animation for the viewer frame loop */
    startDoorAnimation: (doorId: AnyNodeId, value: DoorAnimationState) => void;
    /** Cancel a queued door animation */
    cancelDoorAnimation: (doorId: AnyNodeId) => void;
    /** Set transient window open state without committing it to the scene node */
    setWindowOpenState: (windowId: AnyNodeId, value: WindowInteractiveState) => void;
    /** Clear transient window open state */
    removeWindowOpenState: (windowId: AnyNodeId) => void;
    /** Queue a window animation for the viewer frame loop */
    startWindowAnimation: (windowId: AnyNodeId, value: WindowAnimationState) => void;
    /** Cancel a queued window animation */
    cancelWindowAnimation: (windowId: AnyNodeId) => void;
    /** Set transient skylight open state without committing it to the scene node */
    setSkylightOpenState: (skylightId: AnyNodeId, value: SkylightInteractiveState) => void;
    /** Clear transient skylight open state */
    removeSkylightOpenState: (skylightId: AnyNodeId) => void;
    /** Queue a skylight animation for the viewer frame loop */
    startSkylightAnimation: (skylightId: AnyNodeId, value: SkylightAnimationState) => void;
    /** Cancel a queued skylight animation */
    cancelSkylightAnimation: (skylightId: AnyNodeId) => void;
    /** Initialize an elevator's runtime state from its default served level. */
    initElevator: (elevatorId: AnyNodeId, levelId: AnyNodeId, carY: number) => void;
    /** Merge runtime elevator state. */
    setElevatorState: (elevatorId: AnyNodeId, value: Partial<ElevatorInteractiveState>) => void;
    /** Remove elevator runtime state when its renderer unmounts. */
    removeElevator: (elevatorId: AnyNodeId) => void;
};
export declare const useInteractive: import("zustand").UseBoundStore<import("zustand").StoreApi<InteractiveStore>>;
export {};
//# sourceMappingURL=use-interactive.d.ts.map