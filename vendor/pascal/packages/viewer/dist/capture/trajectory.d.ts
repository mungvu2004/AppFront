import { type DeviceMotionTrajectoryPayload } from '@pascal-app/core/capture';
export type DeviceTrajectoryPose = {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    segment: number;
    timestamp: number;
};
export type DeviceTrajectory = {
    duration: number;
    poses: DeviceTrajectoryPose[];
};
export type DeviceTrajectoryFrame = {
    alpha: number;
    from: DeviceTrajectoryPose;
    to: DeviceTrajectoryPose;
};
export declare function parseDeviceTrajectoryPayload(trajectory: DeviceMotionTrajectoryPayload | null | undefined): DeviceTrajectory | null;
export declare function parseDeviceTrajectoryPackets(payloads: readonly unknown[]): DeviceTrajectory | null;
export declare function sampleDeviceTrajectory(trajectory: DeviceTrajectory, elapsed: number): DeviceTrajectoryFrame;
//# sourceMappingURL=trajectory.d.ts.map