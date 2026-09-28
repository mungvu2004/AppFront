import type { FloorplanGeometry } from '@pascal-app/core';
export type AnnotationLabelRectangle = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    priority: number;
    pinnedShift?: {
        dx: number;
        dy: number;
    };
    tangentX?: number;
    tangentY?: number;
    preferredShifts?: readonly {
        dx: number;
        dy: number;
    }[];
};
export type AnnotationObstacleRectangle = Pick<AnnotationLabelRectangle, 'x' | 'y' | 'width' | 'height'>;
export type AnnotationLabelShift = {
    id: string;
    dx: number;
    dy: number;
    resolved: boolean;
};
export type AnnotationLayoutOverride = {
    dx: number;
    dy: number;
    pinned?: boolean;
};
export type AnnotationLayoutOverrides = Readonly<Record<string, AnnotationLayoutOverride>>;
export declare function resolveAnnotationLabelRectangles(rectangles: readonly AnnotationLabelRectangle[], obstacles?: readonly AnnotationObstacleRectangle[]): AnnotationLabelShift[];
export declare function resolveSvgAnnotationCollisions(svg: SVGSVGElement, options?: {
    labels?: readonly SVGGElement[];
    layoutOverrides?: AnnotationLayoutOverrides;
}): void;
export declare function svgAnnotationLabelId(label: SVGGElement, index: number): string;
export declare function polylineObstacleRectangles(points: readonly {
    x: number;
    y: number;
}[]): AnnotationObstacleRectangle[];
export declare function isFloorplanAnnotationObstacleGeometry(geometry: FloorplanGeometry): boolean;
export declare function floorplanAnnotationObstacleMode(geometry: FloorplanGeometry): 'bounds' | 'outline' | '' | undefined;
//# sourceMappingURL=floorplan-annotation-layout.d.ts.map