import { type BufferGeometry } from 'three';
export declare function createColumnBoxGeometry(width: number, height: number, depth: number, bevelRadius?: number): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
export declare function createColumnCylinderGeometry({ height, radiusBottom, radiusTop, radiusX, radiusZ, segments, }: {
    height: number;
    radiusBottom: number;
    radiusTop?: number;
    radiusX?: number;
    radiusZ?: number;
    segments?: number;
}): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
export declare function createColumnSphereGeometry(radius: number, widthSegments?: number, heightSegments?: number): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
export declare function createColumnTorusGeometry({ arc, radialSegments, ringRadius, scaleX, scaleY, scaleZ, tubeRadius, tubularSegments, }: {
    arc?: number;
    radialSegments?: number;
    ringRadius: number;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    tubeRadius: number;
    tubularSegments?: number;
}): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
//# sourceMappingURL=column-geometry.d.ts.map