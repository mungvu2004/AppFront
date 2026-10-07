import { type WindowNode } from '@pascal-app/core';
import type { Object3D } from 'three';
/**
 * Pose a window's moving parts (sash/panel/slats) at `value` (0 = closed,
 * 1 = open) by mutating the named child groups under `mesh`. Returns true when
 * the window type has a direct pose path and the named parts were found.
 *
 * This is the single source of truth for window kinematics: the live animation
 * system poses the registered scene mesh, and the GLB exporter poses an export
 * clone to sample the open/close keyframes for a baked animation clip.
 */
export declare function poseWindowMovingParts(node: WindowNode, mesh: Object3D | undefined, value: number): boolean;
export declare const WindowAnimationSystem: () => null;
//# sourceMappingURL=window-animation-system.d.ts.map