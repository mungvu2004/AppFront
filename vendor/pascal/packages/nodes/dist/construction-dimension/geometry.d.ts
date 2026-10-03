import { type AnyNode, type AnyNodeId, type ConstructionDimensionMode, type ConstructionDimensionNode, type FloorplanPoint, type MeasurementAnchor, type MeasurementPoint } from '@pascal-app/core';
export type ConstructionDimensionSegmentLayout = {
    dimensionStart: FloorplanPoint;
    dimensionEnd: FloorplanPoint;
    value: number;
    witnessStart: FloorplanPoint;
    witnessEnd: FloorplanPoint;
};
export type ConstructionDimensionLayout = {
    dimensionPoints: FloorplanPoint[];
    direction: FloorplanPoint;
    midpoint: FloorplanPoint;
    normal: FloorplanPoint;
    segments: ConstructionDimensionSegmentLayout[];
    witnessPoints: FloorplanPoint[];
};
export declare function alignConstructionDimensionDirectionToSharedWall(direction: readonly [number, number], anchors: readonly MeasurementAnchor[], resolve: (id: AnyNodeId) => AnyNode | undefined): [number, number];
export type CircularConstructionDimensionLayout = {
    center: FloorplanPoint;
    start: FloorplanPoint;
    end: FloorplanPoint | null;
    radius: number;
    startAngle: number;
    endAngle: number;
    sweep: number;
    chordLength: number;
    arcLength: number;
};
export declare function resolveCircularConstructionDimensionLayout(mode: ConstructionDimensionMode, anchors: readonly MeasurementPoint[]): CircularConstructionDimensionLayout | null;
export declare function resolveConstructionDimensionLayout(node: Pick<ConstructionDimensionNode, 'baseline' | 'chainMode'>, anchors: readonly MeasurementPoint[]): ConstructionDimensionLayout;
//# sourceMappingURL=geometry.d.ts.map