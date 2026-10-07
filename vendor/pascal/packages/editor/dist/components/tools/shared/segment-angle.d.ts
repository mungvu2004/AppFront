import { type FenceNode, type WallNode } from '@pascal-app/core';
export type PlanPoint = [number, number];
export type SegmentAngleLike = Pick<WallNode | FenceNode, 'start' | 'end' | 'curveOffset'>;
export type SegmentAngleReference = {
    vector: PlanPoint;
    orientation: 'directed' | 'axis';
};
export type SegmentAngleArc = {
    angle: number;
    startAngle: number;
    endAngle: number;
    midAngle: number;
};
export declare function formatAngleRadians(angle: number): string;
export declare function getAngleBetweenVectors(first: PlanPoint, second: PlanPoint): number | null;
export declare function getAngleToSegmentReference(vector: PlanPoint, reference: SegmentAngleReference): number | null;
export declare function getAngleArcToSegmentReference(vector: PlanPoint, reference: SegmentAngleReference): SegmentAngleArc | null;
export declare function getSegmentAngleReferenceAtPoint(point: PlanPoint, segment: SegmentAngleLike): SegmentAngleReference | null;
//# sourceMappingURL=segment-angle.d.ts.map