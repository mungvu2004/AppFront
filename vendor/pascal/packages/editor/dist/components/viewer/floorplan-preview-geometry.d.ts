import type { FloorplanGeometry, FloorplanPoint } from '@pascal-app/core';
export type FloorplanBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};
export type FloorplanViewBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type FloorplanViewport = {
    left: number;
    top: number;
    width: number;
    height: number;
};
export declare function clientToFloorplanPoint(viewBox: FloorplanViewBox, viewport: FloorplanViewport, clientX: number, clientY: number): FloorplanPoint;
export declare function scaleFloorplanViewBox(viewBox: FloorplanViewBox, factor: number, anchorX?: number, anchorY?: number): FloorplanViewBox;
export declare function scaleFloorplanViewBoxBetweenClients(viewBox: FloorplanViewBox, factor: number, viewport: FloorplanViewport, sourceClient: FloorplanPoint, targetClient: FloorplanPoint): FloorplanViewBox;
export declare function panFloorplanViewBox(viewBox: FloorplanViewBox, viewport: FloorplanViewport, sourceClient: FloorplanPoint, targetClient: FloorplanPoint): FloorplanViewBox;
export declare function getFloorplanBounds(geometries: readonly FloorplanGeometry[]): FloorplanBounds | null;
export declare function padFloorplanBounds(bounds: FloorplanBounds, ratio?: number): FloorplanBounds;
//# sourceMappingURL=floorplan-preview-geometry.d.ts.map