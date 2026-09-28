import type { WallNode } from '../../schema/index.js';
import { type Point2D, type WallMiterData } from './wall-mitering.js';
export { calculateLevelMiters, type Point2D, type WallMiterData } from './wall-mitering.js';
export declare const DEFAULT_WALL_THICKNESS = 0.1;
export declare const DEFAULT_WALL_HEIGHT = 2.5;
export declare const CURVED_WALL_SURFACE_SEGMENTS = 24;
export declare function getWallThickness(wallNode: WallNode): number;
export declare function getWallPlanFootprint(wallNode: WallNode, miterData: WallMiterData): Point2D[];
//# sourceMappingURL=wall-footprint.d.ts.map