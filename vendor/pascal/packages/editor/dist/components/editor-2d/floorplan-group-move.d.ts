import { type AnyNodeId, type FloorplanPalette } from '@pascal-app/core';
import { type PointerEvent as ReactPointerEvent } from 'react';
import { type Vec2 } from '../editor/group-transform-shared';
type FloorplanGroupDragState = {
    delta: Vec2 | null;
    rotation: {
        pivotX: number;
        pivotZ: number;
        angle: number;
    } | null;
    set: (delta: Vec2 | null) => void;
    setRotation: (rotation: FloorplanGroupDragState['rotation']) => void;
};
export declare const useFloorplanGroupDrag: import("zustand").UseBoundStore<import("zustand").StoreApi<FloorplanGroupDragState>>;
/**
 * Try to start a 2D group move for a pointer-down on `nodeId`. Returns false
 * (attaching nothing) unless the node is a transformable member of a
 * multi-selection — the caller falls through to its single-node behavior.
 *
 * `immediate` engages the session on pointer-down (move-handle dot semantics:
 * the dot is an explicit move control); otherwise the session arms and only
 * engages once the pointer travels past the drag threshold, and a plain
 * click falls through to `onClickFallthrough` (the collapse-to-single
 * selection click).
 */
export declare function startFloorplanGroupMove(nodeId: AnyNodeId, event: {
    clientX: number;
    clientY: number;
    pointerId: number;
}, opts?: {
    immediate?: boolean;
    onClickFallthrough?: () => void;
}): boolean;
/**
 * 2D group rotate, driven from the dashed selection box's corner handles —
 * the floor-plan sibling of the 3D `GroupRotateHandle`. The group spins
 * rigidly around its data-extents center; 15° increments by default, Shift
 * for free rotation, one `updateNodes` on release (one undo step).
 */
export declare function startFloorplanGroupRotate(event: {
    clientX: number;
    clientY: number;
    pointerId: number;
}): boolean;
/**
 * Dashed bounding box around the current multi-selection's transformable
 * participants — what a group drag carries (connected walls outside the
 * selection stretch at their shared ends to stay joined) — and IS the group's
 * drag handle: press anywhere
 * inside it to slide the group, click to pick it up. Holding a selection
 * modifier (Cmd/Ctrl/Shift) lets pointer events pass through so members under
 * the box can still be toggled in and out. Rides the live drag delta so it
 * tracks the group mid-gesture. Mounted inside the floor-plan scene `<g>`, so
 * plan coords render directly.
 */
export declare const FloorplanGroupSelectionBox: import("react").MemoExoticComponent<({ palette, unitsPerPixel, onPointerDown, onRotatePointerDown, }: {
    palette: FloorplanPalette | undefined;
    unitsPerPixel: number;
    onPointerDown?: (event: ReactPointerEvent<SVGGElement>) => void;
    onRotatePointerDown?: (event: ReactPointerEvent<SVGGElement>) => void;
}) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=floorplan-group-move.d.ts.map