import type { Ray } from 'three';
type SpatialPointerCapture = {
    onMove: (ray: Ray) => void;
    onRelease: () => void;
    onCancel: () => void;
    onReplace?: () => void;
};
export type SpatialPointerId = object | number | string;
export declare function getSpatialPointerId(nativeEvent: unknown): SpatialPointerId | null;
export declare class SpatialPointerInput {
    private readonly captures;
    capture(pointerId: SpatialPointerId, capture: SpatialPointerCapture): () => void;
    move(pointerId: SpatialPointerId, ray: Ray): boolean;
    release(pointerId: SpatialPointerId): boolean;
    cancel(pointerId: SpatialPointerId): boolean;
}
export declare const spatialPointerInput: SpatialPointerInput;
export {};
//# sourceMappingURL=spatial-pointer-input.d.ts.map