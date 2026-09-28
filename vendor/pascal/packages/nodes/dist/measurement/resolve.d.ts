import { type AnyNode, type AnyNodeId, type MeasurementAnchor, type MeasurementFeature, type MeasurementFeatureReference, type MeasurementNode, type MeasurementPayload, type MeasurementPoint, remapMeasurementReferences } from '@pascal-app/core';
export type ResolvedMeasurementPayload = {
    kind: 'distance';
    points: [MeasurementPoint, MeasurementPoint];
} | {
    kind: 'angle';
    points: [MeasurementPoint, MeasurementPoint, MeasurementPoint];
} | {
    kind: 'area';
    base: MeasurementPoint[];
} | {
    kind: 'perimeter';
    base: MeasurementPoint[];
} | {
    kind: 'volume';
    base: MeasurementPoint[];
    extrusion: MeasurementPoint;
};
export type ResolvedMeasurement = {
    payload: ResolvedMeasurementPayload;
    dangling: MeasurementFeatureReference[];
    dependencies: AnyNodeId[];
    anchorNormals: Array<MeasurementPoint | null>;
};
type NodeResolver = (id: AnyNodeId) => AnyNode | undefined;
export type MeasurementFeatureMatch = {
    feature: MeasurementFeature;
    point: MeasurementPoint;
    t: number;
    parameters: Record<string, string | number | boolean>;
    distance: number;
};
export declare function measurementFeaturesForNode(node: AnyNode, resolve: NodeResolver): MeasurementFeature[];
export declare function matchMeasurementFeatureForNode(node: AnyNode, resolve: NodeResolver, point: MeasurementPoint, maxDistance: number): MeasurementFeatureMatch | null;
export declare function closestMeasurementFeature(features: readonly MeasurementFeature[], point: MeasurementPoint, maxDistance: number): MeasurementFeatureMatch | null;
export declare function measurementFeaturePoint(feature: MeasurementFeature, reference: MeasurementFeatureReference): MeasurementPoint | null;
export declare function resolveMeasurementAnchor(anchor: MeasurementAnchor, resolve: NodeResolver): {
    point: MeasurementPoint;
    normal: MeasurementPoint | null;
    dangling: MeasurementFeatureReference | null;
};
export declare function measurementDependencyIds(measurement: MeasurementPayload, resolve?: NodeResolver): AnyNodeId[];
export declare function resolveMeasurementNode(node: Pick<MeasurementNode, 'measurement'>, resolve: NodeResolver): ResolvedMeasurement;
export declare function detachMeasurementPayload(node: Pick<MeasurementNode, 'measurement'>, resolve: NodeResolver): MeasurementPayload;
export declare function freeMeasurementPoint(anchor: MeasurementAnchor): MeasurementPoint;
export { remapMeasurementReferences };
//# sourceMappingURL=resolve.d.ts.map