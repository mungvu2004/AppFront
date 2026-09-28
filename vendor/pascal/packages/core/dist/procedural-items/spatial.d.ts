import type { Vec3 } from './recipe.js';
export type Frame = {
    position: Vec3;
    axes: [Vec3, Vec3, Vec3];
};
export type Bounds = {
    min: Vec3;
    max: Vec3;
    dimensions: Vec3;
};
export declare const IDENTITY_FRAME: Frame;
export declare function rotateVector([x, y, z]: Vec3, [rx, ry, rz]: Vec3): Vec3;
export declare function frame(position: Vec3, rotation?: Vec3): Frame;
export declare function direction(f: Frame, p: Vec3): Vec3;
export declare function transformPoint(f: Frame, p: Vec3): Vec3;
export declare function composeFrames(a: Frame, b: Frame): Frame;
export declare function boundsOf(points: Vec3[]): Bounds;
export declare function boxCorners(min: Vec3, max: Vec3): Vec3[];
//# sourceMappingURL=spatial.d.ts.map