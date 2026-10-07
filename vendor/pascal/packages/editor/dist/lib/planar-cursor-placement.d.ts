export type PlanarPoint = [number, number];
export type PlanarCursorPlacementMode = 'absolute' | 'relative';
type ResolvePlanarCursorPositionArgs = {
    cursor: PlanarPoint;
    original: PlanarPoint;
    anchor: PlanarPoint | null;
    mode: PlanarCursorPlacementMode;
    localCenter?: [number, number, number];
    rotationY?: number;
    snap?: (value: number) => number;
    snapPoint?: (point: PlanarPoint) => PlanarPoint;
};
type ResolvePlanarCursorPositionResult = {
    point: PlanarPoint;
    anchor: PlanarPoint | null;
};
type ResolvePrioritizedPlanarCursorPositionArgs = ResolvePlanarCursorPositionArgs & {
    resolveAttachment?: (proposal: PlanarPoint) => PlanarPoint | null;
};
type ResolvePrioritizedPlanarCursorPositionResult = ResolvePlanarCursorPositionResult & {
    attachmentSnapped: boolean;
};
export declare function offsetPlanPositionByLocalCenter(position: [number, number, number], center: [number, number, number], rotationY: number): [number, number, number];
export declare function resolvePlanarCursorPosition({ cursor, original, anchor, mode, localCenter, rotationY, snap, snapPoint, }: ResolvePlanarCursorPositionArgs): ResolvePlanarCursorPositionResult;
export declare function resolvePrioritizedPlanarCursorPosition({ resolveAttachment, ...args }: ResolvePrioritizedPlanarCursorPositionArgs): ResolvePrioritizedPlanarCursorPositionResult;
export {};
//# sourceMappingURL=planar-cursor-placement.d.ts.map