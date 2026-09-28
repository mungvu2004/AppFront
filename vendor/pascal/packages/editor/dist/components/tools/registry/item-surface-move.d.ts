import { type AnyNode, type GridEvent, type NodeEvent } from '@pascal-app/core';
import { type Camera } from 'three';
export declare function createItemSurfacePointerArbitration(): {
    hit(id: string, event: object): void;
    clear(): void;
    blocksGrid(event: object): boolean;
};
export declare function createItemSurfaceGridDispatch(apply: (event: GridEvent) => void): {
    schedule(event: GridEvent): void;
    flush: () => void;
    cancel: () => void;
};
export type ItemSurfaceGrab = {
    hostId: string;
    start: [number, number, number];
    anchor: [number, number, number] | null;
};
export declare function resolveItemSurfaceGrab(grab: ItemSurfaceGrab | null, hostId: string, raw: [number, number, number]): {
    grab: ItemSurfaceGrab | null;
    position: [number, number, number];
};
export declare function createRegistryItemSurfaceMove(node: AnyNode): {
    readonly rejection: import("@pascal-app/core").SurfaceRejectReason | null;
    clearRejectionForGrid(event: GridEvent): void;
    readonly valid: boolean;
    readonly hosted: boolean;
    worldYaw(yaw: number): number;
    planPose(position: [number, number, number], yaw: number): {
        position: [number, number, number];
        rotationY: number;
    };
    enter(event: NodeEvent<AnyNode>, dimensions: [number, number, number], yaw: number): {
        position: [number, number, number];
        rotationY: number;
        worldPosition: import("three").Vector3Tuple;
    } | null;
    blocksGrid(event: GridEvent, camera?: Camera): boolean;
    leave(event: NodeEvent<AnyNode>, yaw: number): {
        position: [number, number, number];
        rotationY: number;
    } | null;
    detach(worldPosition: [number, number, number], yaw: number): {
        position: [number, number, number];
        rotationY: number;
    } | null;
    rotate(yaw: number): {
        position: [number, number, number];
        rotationY: number;
    } | null;
    restore(): void;
} | null;
//# sourceMappingURL=item-surface-move.d.ts.map