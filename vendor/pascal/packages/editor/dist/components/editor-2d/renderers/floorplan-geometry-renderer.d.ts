import { type FloorplanGeometry } from '@pascal-app/core';
type FloorplanRenderMode = 'screen' | 'pdf';
/**
 * Pure-data → SVG converter. Walks a `FloorplanGeometry` tree returned by
 * `def.floorplan(node, ctx)` and emits the matching React-SVG nodes.
 *
 * Coordinates are level-local meters. The wrapping floor-plan panel
 * applies the world→SVG transform via its viewBox, so kinds emit
 * geometry in the same units they reason about in 3D.
 *
 * Group transforms compose: `transform={translate(x y) rotate(deg)}`.
 * Rotations are radians at the data layer (consistent with three.js
 * conventions used by `def.geometry`) and converted to degrees for SVG
 * here — kinds never touch units.
 *
 * Styling props map straight onto SVG attributes. Builders that need
 * theme colors should declare them inline or expose them as registry
 * tokens later (deferred until a real need surfaces — AI-authored kinds
 * can pick safe defaults today).
 */
export declare const FloorplanGeometryRenderer: import("react").MemoExoticComponent<({ geometry, pointerEventsOverride, sceneRotationDeg, annotationUnitsPerPoint, screenUnitsPerPixel, renderMode, }: {
    geometry: FloorplanGeometry;
    pointerEventsOverride?: string;
    sceneRotationDeg?: number;
    annotationUnitsPerPoint?: number;
    screenUnitsPerPixel?: number;
    renderMode?: FloorplanRenderMode;
}) => import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | null>;
export declare function resolveDocumentFloorplanAnnotationStyle(geometry: FloorplanGeometry & {
    kind: Exclude<FloorplanGeometry['kind'], 'group'>;
}, annotationUnitsPerPoint?: number): {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    vectorEffect?: 'non-scaling-stroke';
};
export declare function documentRectGeometryAttrs(geometry: Extract<FloorplanGeometry, {
    kind: 'rect';
}>, annotationUnitsPerPoint?: number): {
    x: number;
    y: number;
    width: number;
    height: number;
    rx: number | undefined;
    ry: number | undefined;
};
export declare function documentCircleGeometryAttrs(geometry: Extract<FloorplanGeometry, {
    kind: 'circle';
}>, annotationUnitsPerPoint?: number): {
    r: number;
};
export declare function resolveDocumentAnnotationGroupChildren(children: FloorplanGeometry[], annotationUnitsPerPoint?: number): FloorplanGeometry[];
export {};
//# sourceMappingURL=floorplan-geometry-renderer.d.ts.map