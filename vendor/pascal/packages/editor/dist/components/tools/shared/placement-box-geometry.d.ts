import { BufferGeometry, type LineSegments } from 'three';
/**
 * Axis-aligned box description shared by every placement-cursor wireframe.
 * `dimensions` is the box extent on each axis; `center` is its centre in the
 * cursor group's local space (so an off-centre mesh bbox stays off-centre).
 * `min`/`max` are kept for callers that need the explicit corners.
 */
export type PreviewBounds = {
    min: [number, number, number];
    max: [number, number, number];
    dimensions: [number, number, number];
    center: [number, number, number];
};
export declare function createLineGeometry(points?: number[]): BufferGeometry;
/** Flatten a box's 12 edges into a `LineSegments` position array. */
export declare function getBoxEdgePoints(bounds: PreviewBounds): number[];
export declare function updateLineGeometry(ref: React.RefObject<LineSegments>, points: number[]): void;
//# sourceMappingURL=placement-box-geometry.d.ts.map