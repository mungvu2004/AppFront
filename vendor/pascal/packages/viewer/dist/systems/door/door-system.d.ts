import { type DoorNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const DoorSystem: () => null;
/**
 * Pose an operation door's moving parts (sliding/pocket/barn leaf, tilt-up and
 * sectional panels, folding chain, roll-up curtain) at `value` (0 = closed,
 * 1 = open) by transforming the named groups its builder emitted at the closed
 * pose. Returns true when the door type has a pose path and its groups exist.
 *
 * Mirrors `poseWindowMovingParts`: the live door system calls it after a
 * (re)build so `operationState` is reflected, and the GLB exporter calls it on a
 * clone to sample keyframes. Swing doors are not handled here — their leaf group
 * carries a `pascalSwingLeaf` marker the exporter reads directly.
 *
 * Roll-up is the one type whose live geometry changes (slats vanish onto a
 * drum), which a glTF clip can't express; the baked approximation scales the
 * curtain up into the lintel. The live roll-up animation keeps its full-detail
 * rebuild and is intentionally NOT routed through this scale.
 */
export declare function poseDoorMovingParts(node: DoorNode, mesh: THREE.Object3D | undefined, value: number): boolean;
/**
 * Build a fresh door mesh for preview/ghost rendering.
 * Returns a mesh with an invisible hitbox root and visible children (frame, panels, hardware).
 */
export declare function buildDoorPreviewMesh(node: DoorNode): THREE.Mesh;
//# sourceMappingURL=door-system.d.ts.map