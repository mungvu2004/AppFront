import type { Layers } from 'three';
export declare function enableImmersiveXRViewLayers(cameraLayers: Layers, raycasterLayers: Layers): () => void;
export declare function viewerCameraClipping(immersiveXR: boolean): {
    far: number;
    near: number;
};
export declare function applyViewerCameraClipping(camera: {
    far: number;
    near: number;
    updateProjectionMatrix(): void;
}, immersiveXR: boolean): void;
export declare function viewerUsesPerspectiveCamera(cameraMode: string, immersiveXR: boolean): boolean;
export declare const ViewerCamera: ({ immersiveXR }: {
    immersiveXR?: boolean;
}) => import("react").JSX.Element;
//# sourceMappingURL=viewer-camera.d.ts.map