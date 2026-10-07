import type { DuctFittingNode, PipeFittingNode } from '@pascal-app/core';
type Point = [number, number, number];
export declare function createFittingSurfaceSupport(): (node: DuctFittingNode | PipeFittingNode, rotation: Point, position: Point, surfacePoint: Point, surfaceNormal?: Point) => Point;
export {};
//# sourceMappingURL=fitting-surface-support.d.ts.map