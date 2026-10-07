import { type AnyNodeId } from '@pascal-app/core';
import { type Camera, type Raycaster } from 'three';
/**
 * Arm a 3D group move from a pointer-down on `nodeId`. Returns false
 * (attaching nothing) unless the node is a transformable member of a
 * multi-selection.
 */
export declare function armGroupMove3d(args: {
    nodeId: AnyNodeId;
    clientX: number;
    clientY: number;
    pointerId: number;
    nativeEvent: PointerEvent;
    camera: Camera;
    raycaster: Raycaster;
    domElement: HTMLCanvasElement;
}): boolean;
//# sourceMappingURL=group-move-3d.d.ts.map