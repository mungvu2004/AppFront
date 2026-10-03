import type { Cursor } from '@pascal-app/core';
import type { ThreeEvent } from '@react-three/fiber';
type Point = [number, number, number];
/**
 * Small persistent cube the user CLICKS to latch a directional handle cluster
 * open (click again to close). A `tracker` HandleArrow (a tiny cube) reused so
 * it shares the rig's hit-area / depth / outline treatment, sized to match the
 * roof-segment pitch cube (`baseScale = zoom`, full `TRACKER_CUBE_SIZE`).
 * `hoverScale = 1.15` grows it 15% on hover / while its cluster is open so it
 * reads as clickable. Shared by the duct-segment and duct-fitting selection
 * rigs so every editing cube is the same size.
 */
export declare function HandleCube({ position, active, onClick, onPointerDown, rotationY, cursor, }: {
    position: Point;
    active: boolean;
    onClick?: () => void;
    onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
    /** Yaw (radians) so the cube can align with the run it sits on. */
    rotationY?: number;
    cursor?: Cursor;
}): import("react").JSX.Element;
/**
 * In-world chevron arrow handle — a thin wrapper over the editor's shared
 * `HandleArrow` so directional move arrows render as the same solid violet
 * plate (depth-written, ink-edge outlined) the wall arrows use. Lays flat in
 * the XZ plane pointing along +X (yawed by `rotationY`); `vertical` tips the
 * chevron up / down for the riser pair. Scales with ortho zoom for a constant
 * on-screen size.
 */
export declare function MoveChevron({ position, rotationY, vertical, cursor, onPointerDown, }: {
    position: Point;
    rotationY?: number;
    vertical?: 'up' | 'down';
    cursor?: Cursor;
    onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}): import("react").JSX.Element;
/**
 * Rotation arc handle — the editor's `curved-arrow` (which wraps world +Y by
 * default) re-oriented by an arbitrary `rotation` euler. Scales with ortho zoom
 * for a constant on-screen size. The caller supplies the position + orientation
 * so the same component serves a duct's single roll arc and a fitting's three
 * per-axis arcs.
 */
export declare function RotateArc({ position, rotation, cursor, onPointerDown, }: {
    position: Point;
    rotation: [number, number, number];
    cursor?: Cursor;
    onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}): import("react").JSX.Element;
export declare function ContinuePlusHandle({ position, onActivate, }: {
    position: Point;
    onActivate: () => void;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=selection-handles.d.ts.map