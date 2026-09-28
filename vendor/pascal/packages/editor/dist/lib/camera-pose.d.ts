import type { CameraPose } from '@pascal-app/core';
export type CameraPoseApplicationPlan = {
    pose: CameraPose;
    perspectiveFov: number | null;
};
export type CameraPoseInterpolationStep = {
    position: [number, number, number];
    settled: boolean;
    target: [number, number, number];
};
export declare function publishInitialCameraPose(publishCurrentPose: () => void): void;
export declare function releaseCameraPoseEventSuppression(suppression: {
    current: boolean;
}, publishCurrentPose: () => void): void;
export declare function normalizeCameraPose(value: unknown): CameraPose | null;
export declare function planCameraPoseApplication(value: unknown): CameraPoseApplicationPlan | null;
export declare function withCameraPoseDistance(pose: CameraPose, distance: number): CameraPose;
export declare function stepCameraPoseInterpolation(currentPosition: [number, number, number], currentTarget: [number, number, number], destination: CameraPose, deltaSeconds: number): CameraPoseInterpolationStep;
//# sourceMappingURL=camera-pose.d.ts.map