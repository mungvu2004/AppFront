import type { SurfaceRegion } from './surface-hosting.js';
export declare function surfaceRegionContainsPoint(region: SurfaceRegion | undefined, point: readonly [number, number]): boolean;
/** Position and XYZ rotation are surface-local; bounds and size are scaled child-local values. */
export declare function surfaceRegionContainsFootprint(region: SurfaceRegion | undefined, position: readonly [number, number, number], size: readonly [number, number, number], rotation: number | readonly [number, number, number], localBounds?: {
    min: readonly [number, number, number];
    max: readonly [number, number, number];
}): boolean;
//# sourceMappingURL=surface-region.d.ts.map