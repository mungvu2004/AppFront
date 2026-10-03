export type FloorplanCursorPoint = {
    x: number;
    y: number;
};
type Matrix2D = {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
};
export declare function projectFloorplanCursorPoint(point: readonly [number, number], sceneToViewport: Matrix2D, overlayOrigin: FloorplanCursorPoint): FloorplanCursorPoint;
export declare function resolveFloorplanCursorIndicatorPosition(cursorPosition: FloorplanCursorPoint | null, projectedCursorPosition: FloorplanCursorPoint | null): FloorplanCursorPoint | null;
export {};
//# sourceMappingURL=floorplan-cursor-indicator-position.d.ts.map