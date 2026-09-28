import type { LeanToExtensionNode, Point2D } from '@pascal-app/core';
export type LeanToArcLike = Pick<LeanToExtensionNode, 'spanArcCenterZ' | 'spanArcRadius'>;
export type LeanToArcFrame = {
    point: Point2D;
    tangent: Point2D;
    normal: Point2D;
    rotationY: number;
};
export declare function isCurvedLeanTo(node: LeanToArcLike): boolean;
export declare function bendLocalPoint(node: LeanToArcLike, localX: number, localZ: number): Point2D;
export declare function bendRotationYAtLocalX(node: LeanToArcLike, localX: number): number;
export declare function leanToArcFrameAtLocalX(node: LeanToArcLike, localX: number): LeanToArcFrame;
export declare function leanToArcRadius(node: LeanToArcLike): number;
//# sourceMappingURL=arc.d.ts.map