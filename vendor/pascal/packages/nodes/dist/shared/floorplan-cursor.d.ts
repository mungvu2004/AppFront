import { type PlanarCursorPlacementMode, type PlanarPoint } from '@pascal-app/editor';
type FloorplanCursorResolverOptions = {
    snap?: (value: number) => number;
};
export declare function createFloorplanCursorResolver(args: {
    original: readonly [number, number];
    metadata?: unknown;
    mode?: PlanarCursorPlacementMode;
}): (planPoint: readonly [number, number], options?: FloorplanCursorResolverOptions) => PlanarPoint;
export {};
//# sourceMappingURL=floorplan-cursor.d.ts.map