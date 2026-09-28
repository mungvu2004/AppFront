import { type CameraPose } from '@pascal-app/core';
import type { NavigationSyncPose, NavigationSyncPoseInput } from '../../store/use-editor';
export declare function cameraPoseToFloorplanNavigationPose(pose: CameraPose): NavigationSyncPoseInput | null;
export declare function floorplanNavigationPoseToCameraPose(navigationPose: NavigationSyncPose, cameraPose: CameraPose): CameraPose;
export type FloorplanCameraSyncBridge = {
    receiveCameraPose: (pose: CameraPose) => void;
    receiveNavigationPose: (pose: NavigationSyncPose | null) => void;
    setActive: (active: boolean) => void;
};
export type FloorplanCameraNavigationChannel = {
    publish: (pose: NavigationSyncPoseInput) => void;
    subscribe: (listener: (pose: NavigationSyncPose) => void) => () => void;
};
export declare function createFloorplanCameraNavigationChannel(): FloorplanCameraNavigationChannel;
export declare function subscribeFloorplanCameraNavigation(listener: (pose: NavigationSyncPose) => void): () => void;
export declare function createFloorplanCameraSyncBridge({ active: initialActive, applyCameraPose, publishNavigationPose, }: {
    active?: boolean;
    applyCameraPose: (pose: CameraPose) => void;
    publishNavigationPose: (pose: NavigationSyncPoseInput) => void;
}): FloorplanCameraSyncBridge;
export declare function useFloorplanCameraSyncBridge(): void;
//# sourceMappingURL=floorplan-camera-sync.d.ts.map