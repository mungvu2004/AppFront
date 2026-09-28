import { type Camera, type Scene } from 'three';
import { type WebGPURenderer } from 'three/webgpu';
import type { SceneAtmosphereSource } from '../components/viewer/scene-atmosphere';
import { type EdgeMode } from './edge-style';
export declare const THUMBNAIL_WIDTH = 1920;
export declare const THUMBNAIL_HEIGHT = 1080;
/**
 * Captures are re-renderable artifacts, not user originals, so they encode as
 * webp: a 1920×1080 hero shot lands roughly an order of magnitude under PNG,
 * which is what listings and the catalog actually ship over the wire. Alpha
 * survives, so transparent item/preset captures keep working.
 */
export declare const SNAPSHOT_MIME = "image/webp";
export declare const SNAPSHOT_QUALITY = 0.9;
export declare const SNAPSHOT_MAX_EDGE = 2048;
export type SnapshotCaptureMode = 'standard' | 'viewport' | 'area';
export type SnapshotCropRegion = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type SnapshotSize = {
    w: number;
    h: number;
};
export type SnapshotCaptureResult = {
    blob: Blob;
    outW: number;
    outH: number;
};
export type SnapshotPipeline = {
    applyEnvironment: ({ theme, transparent, grade, edges, camera, }: {
        theme: string;
        transparent: boolean;
        grade: boolean;
        edges: EdgeMode;
        camera: Camera;
    }) => void;
    capture: ({ captureMode, cropRegion, standardSize, mime, }: {
        captureMode?: SnapshotCaptureMode;
        cropRegion?: SnapshotCropRegion;
        standardSize?: SnapshotSize;
        /** The encoding, when not the snapshot default (a print picture wants a lossless `image/png`). */
        mime?: string;
    }) => Promise<SnapshotCaptureResult>;
    dispose: () => void;
};
export declare function createSnapshotPipeline({ renderer, scene, camera, atmosphere, }: {
    renderer: WebGPURenderer;
    scene: Scene;
    camera: Camera;
    atmosphere?: SceneAtmosphereSource | null;
}): Promise<SnapshotPipeline | null>;
/**
 * A capture WITHOUT the post-processing stack: the scene as the renderer
 * draws it, into an offscreen target, read back and encoded like the
 * post-processed frames. The sheets' orthographic elevation captures use
 * it (2026-09-10): an SSGI pass built for a second, orthographic camera
 * never delivered a frame and held the generator's guard forever.
 */
export declare function createPlainSnapshotPipeline({ renderer, scene, camera, }: {
    renderer: WebGPURenderer;
    scene: Scene;
    camera: Camera;
}): Promise<SnapshotPipeline | null>;
//# sourceMappingURL=snapshot-pipeline.d.ts.map