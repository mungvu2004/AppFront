import { type CameraPose } from '@pascal-app/core';
export type ViewCubeFace = 'top' | 'front' | 'back' | 'left' | 'right' | 'iso';
export declare const VIEW_CUBE_FACES: ViewCubeFace[];
/** Camera pose looking at `center` from `face`, `distance` away. */
export declare function viewCubePose(face: ViewCubeFace, center: [number, number, number], distance: number, projection: CameraPose['projection']): CameraPose;
/**
 * In-canvas half: turns a face click into a pose for the host's camera
 * controls (`camera-controls:apply-pose`, the same channel the floorplan sync
 * uses), so the editor's own controls animate the flight and keep their target.
 */
export declare function ViewCubeBridge(): null;
/**
 * DOM half, outside <Canvas>. Buttons rather than a rotating 3D cube: each
 * face is a named, tabbable control (A12 keyboard path), and nothing here
 * needs a second render pass on the WebGPU limiter.
 * ponytail: the cube does not rotate with the camera; add a camera-synced CSS transform if users ask.
 */
export declare function ViewCube(): import("react").JSX.Element;
//# sourceMappingURL=view-cube.d.ts.map