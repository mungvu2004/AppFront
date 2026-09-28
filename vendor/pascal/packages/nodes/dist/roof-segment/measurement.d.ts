import { type MeasurementFeature, type MeasurementFeatureBinding, type RoofNode, type RoofSegmentNode } from '@pascal-app/core';
export declare function roofSegmentMeasurementFeatures(node: RoofSegmentNode, roof: RoofNode | null): MeasurementFeature[];
export declare function matchRoofSegmentMeasurementFeature(node: RoofSegmentNode, roof: RoofNode | null, hit: [number, number, number], maxDistance: number): MeasurementFeatureBinding | null;
//# sourceMappingURL=measurement.d.ts.map