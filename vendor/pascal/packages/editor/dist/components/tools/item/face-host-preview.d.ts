import type { Object3D } from 'three';
type Vector3Tuple = readonly [number, number, number];
type FaceBounds = {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
};
export declare function applyFaceHostPreviewPose(mesh: Object3D, position: Vector3Tuple, rotation: Vector3Tuple): void;
export declare function resolveFaceHostSwitch(currentFaceId: string | null | undefined, nextFaceId: string | null | undefined, pendingFaceId: string | null): {
    accept: boolean;
    pendingFaceId: string | null;
};
export declare function shouldDetachFaceHostOnLeave(attachTo: string | undefined): boolean;
export declare function clampFaceHostPosition(position: Vector3Tuple, bounds: FaceBounds, dimensions: readonly [width: number, height: number]): [number, number, number] | null;
export declare function clampFaceHostCenterPosition(position: Vector3Tuple, bounds: FaceBounds, dimensions: readonly [width: number, depth: number]): [number, number, number] | null;
export {};
//# sourceMappingURL=face-host-preview.d.ts.map