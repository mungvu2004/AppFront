import type { NavigationSyncPose } from '../../store/use-editor';
import type { FloorplanViewBox } from './floorplan-preview-geometry';
export type FloorplanPreviewViewportSize = {
    width: number;
    height: number;
};
export declare function nearestEquivalentDegrees(angle: number, reference: number): number;
export declare function floorplanRotationFromCameraAzimuth(azimuth: number, reference: number): number;
export declare function cameraAzimuthFromFloorplanRotation(rotationDeg: number): number;
export declare function rotateFloorplanPoint(point: {
    x: number;
    y: number;
}, rotationDeg: number): {
    x: number;
    y: number;
};
export declare function visibleFloorplanViewWidth(viewBox: FloorplanViewBox, viewport: FloorplanPreviewViewportSize): number;
export declare function floorplanViewBoxFromNavigationPose(pose: NavigationSyncPose, localCenter: {
    x: number;
    y: number;
}, sceneRotationDeg: number, viewport: FloorplanPreviewViewportSize): FloorplanViewBox;
//# sourceMappingURL=floorplan-preview-navigation.d.ts.map