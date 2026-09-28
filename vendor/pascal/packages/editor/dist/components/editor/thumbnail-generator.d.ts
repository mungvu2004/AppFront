import * as THREE from 'three';
import { type WebGPURenderer } from 'three/webgpu';
export interface SnapshotCameraData {
    requestId?: string;
    position: [number, number, number];
    quaternion?: [number, number, number, number];
    fov?: number;
    target: [number, number, number] | null;
    type?: 'perspective' | 'orthographic';
    zoom?: number;
    captureMode?: 'standard' | 'viewport' | 'area';
    resolution?: {
        w: number;
        h: number;
    };
}
interface ThumbnailGeneratorProps {
    onThumbnailCapture?: (blob: Blob, cameraData: SnapshotCameraData) => void;
}
type Tile = {
    /** The pixels the tile renders, overlap included. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** The pixels it contributes to the picture. */
    inner: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
};
/**
 * A `width × height` picture split into equal tiles no larger than
 * `passEdge`, each rendered TILE_OVERLAP past its inner edges so the
 * screen-space passes (AO, ink, FXAA) have their neighbourhood at a seam.
 * One tile when the picture fits a pass.
 */
export declare function tileGrid(width: number, height: number, passEdge: number): Tile[];
/**
 * `render` with the renderer's canvas target swapped for a detached one of
 * `width × height`. Every pass of a capture pipeline sizes itself from the
 * renderer's drawing buffer, so a supersampled capture renders at its own
 * size into its own targets while the live canvas — and the live pipeline's
 * targets — keep theirs. Only for renders into a render target: nothing may
 * draw to the screen while the stand-in is current.
 */
export declare function atCaptureSize<T>(renderer: WebGPURenderer, width: number, height: number, render: () => T): T;
/**
 * Run the frame loop `n` times by hand — the useFrame subscribers and the
 * render — a macrotask apart so React's commits land between the frames.
 *
 * With `frameloop="never"` R3F takes each frame's delta as `timestamp −
 * clock.elapsedTime`, and the viewer's FrameLimiter keeps that clock in
 * SECONDS since it mounted. A pumped frame steps it by a millisecond and puts
 * it back, so the next real frame gets exactly its own delta. (Pumping it with
 * `performance.now()` — milliseconds — handed the next real frame a delta of
 * minus hundreds of thousands of seconds: every delta-scaled lerp blew up, the
 * lights and the backdrop to ±1e6, and the 3D view went black, then colours,
 * while the next capture came back black or blown out white — 2026-09-22.)
 */
export declare function pumpFrames(advance: (timestamp: number, runGlobalEffects?: boolean) => void, clock: {
    elapsedTime: number;
    oldTime: number;
}, n: number): Promise<void>;
/**
 * Objects a renderer tagged `userData.excludeFromCapture` (a plugin's site
 * context, e.g. a utility pole and its drop) hidden for a sheet's capture; the
 * returned function shows them again.
 */
export declare function hideCaptureExcluded(scene: THREE.Scene): () => void;
/** The viewer switched to FINISHED_PRESENTATION; the returned function puts the user's view back. */
export declare function presentFinished(): () => void;
export declare const ThumbnailGenerator: ({ onThumbnailCapture }: ThumbnailGeneratorProps) => null;
export {};
//# sourceMappingURL=thumbnail-generator.d.ts.map