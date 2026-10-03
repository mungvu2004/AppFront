import { type WallNode } from '@pascal-app/core';
import type { Camera } from 'three';
import { type Mesh, Vector3 } from 'three/webgpu';
import { type WallMode } from '../../store/use-viewer';
import { WallCutoutCache, type WallCutoutViewerStore } from './wall-cutout-cache';
import { type WallMaterialsResolver } from './wall-materials';
export declare const WALL_CUTOUT_FRAME_PRIORITY = 0;
export declare function runWallCutoutFrame(cache: WallCutoutCache, { camera, clock }: {
    camera: Camera;
    clock: {
        elapsedTime: number;
    };
}): void;
/**
 * Whether a wall should be hidden or see-through for the current camera and
 * wall mode. Pure: reads only its arguments and the mesh's world direction.
 *
 * Exported so hosts rendering their own layers inside `<Viewer>` can match
 * these semantics instead of re-deriving the facing test or inferring state
 * from the assigned material variant.
 */
export declare function getWallHideState(wallNode: WallNode, wallMesh: Mesh, wallMode: WallMode, cameraDir: Vector3): boolean;
export declare const WallCutout: ({ viewerStore, materialResolver, }: {
    viewerStore?: WallCutoutViewerStore;
    materialResolver?: WallMaterialsResolver;
}) => null;
//# sourceMappingURL=wall-cutout.d.ts.map