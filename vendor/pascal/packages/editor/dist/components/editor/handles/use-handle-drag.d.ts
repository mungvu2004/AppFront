import { type AnyNode, type AnyNodeId, type Cursor, createSceneApi, type HandleDragModifiers } from '@pascal-app/core';
import { type ThreeEvent } from '@react-three/fiber';
import { type Camera, type Object3D, type Plane, type Ray, type Vector3 } from 'three';
export type HandleDragControls = {
    onStart: (index: number, snapshot: AnyNode) => void;
    onEnd: () => void;
};
type IntersectPlane = (clientX: number, clientY: number, plane: Plane, target: Vector3) => Vector3 | null;
type GetPointerRay = (clientX: number, clientY: number, target: Ray) => Ray;
export type HandleDragStartContext = {
    event: ThreeEvent<PointerEvent>;
    camera: Camera;
    getPointerRay: GetPointerRay;
    intersectPlane: IntersectPlane;
    initialNode: AnyNode;
    node: AnyNode;
    nodeId: AnyNodeId;
    rideObject: Object3D;
    sceneApi: ReturnType<typeof createSceneApi>;
};
export type HandleDragMoveContext = {
    event: PointerEvent;
    modifiers: HandleDragModifiers;
    getPointerRay: GetPointerRay;
    intersectPlane: IntersectPlane;
};
type HandleDragSession = {
    move: (context: HandleDragMoveContext) => Partial<AnyNode> | null;
    commit?: (patch: Partial<AnyNode>) => void;
    markDirty?: boolean;
    onBegin?: () => void;
    onCancel?: () => void;
    onEnd?: () => void;
    overrideId?: AnyNodeId;
};
type UseHandleDragArgs = {
    kind: 'drag';
    cursor: Cursor;
    dragControls: HandleDragControls;
    handleIndex: number;
    node: AnyNode;
    onStart: (context: HandleDragStartContext) => HandleDragSession | null;
    rideObject: Object3D;
    setIsDragging: (dragging: boolean) => void;
} | {
    kind: 'tap';
    onTap: (event: ThreeEvent<PointerEvent>) => void;
};
export declare function swallowNextClick(): void;
export declare function useHandleDrag(args: UseHandleDragArgs): (event: ThreeEvent<PointerEvent>) => void;
export {};
//# sourceMappingURL=use-handle-drag.d.ts.map