import { type AnyNode } from '@pascal-app/core';
import { Vector3 } from 'three';
/** R/T rotation step — 45°, matching the editor's default rotate. */
export declare const ROTATE_STEP_RAD: number;
export type RotationAxis = 'x' | 'y' | 'z';
export declare const AXIS_VECTORS: Record<RotationAxis, Vector3>;
export declare const getRotationAxis: () => RotationAxis;
export declare const cycleRotationAxis: () => RotationAxis;
/**
 * Compose a world-frame rotation around `axis` onto an existing euler.
 * World-frame (premultiply) so the axes the user cycles through always
 * mean the screen-space X/Y/Z they expect, regardless of how the fitting
 * is already turned.
 */
export declare function rotateEulerWorld(rotation: readonly [number, number, number], axis: RotationAxis, steps: 1 | -1): [number, number, number];
/**
 * R / T keyboard action for a placed fitting — rotate ±45° around the
 * shared active axis (Alt cycles it; see `selection.tsx`).
 */
export declare function rotateFittingNode(node: AnyNode, steps: 1 | -1): void;
//# sourceMappingURL=fitting-rotation.d.ts.map