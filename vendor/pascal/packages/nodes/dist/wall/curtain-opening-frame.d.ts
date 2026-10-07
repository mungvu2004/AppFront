import { type DoorNode, type WallNode, type WindowNode } from '@pascal-app/core';
import { type BufferGeometry, Vector2 } from 'three';
export declare function mapCurtainOpeningGeometryToWall(geometry: BufferGeometry, wall: WallNode): void;
export declare function curtainOpeningProfile(opening: DoorNode | WindowNode, width: number): {
    inner: Vector2[];
    outer: Vector2[];
};
export declare function buildCurtainOpeningFrame(opening: DoorNode | WindowNode, width: number, depth: number): {
    frame: BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
    cutter: BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
    cutout: Vector2[];
};
export declare function curtainProfileSpan(points: readonly Vector2[], height: number): [number, number] | null;
//# sourceMappingURL=curtain-opening-frame.d.ts.map