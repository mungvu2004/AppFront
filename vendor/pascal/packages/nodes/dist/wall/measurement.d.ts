import { type MeasurementFeature, type MeasurementFeatureBinding, type MeasurementFeatureReference, type WallNode } from '@pascal-app/core';
export declare function wallMeasurementFeatures(wall: WallNode): MeasurementFeature[];
export declare function matchWallMeasurementFeature(wall: WallNode, hit: [number, number, number], maxDistance: number): MeasurementFeatureBinding | null;
export declare function resolveWallMeasurementFeature(wall: WallNode, reference: MeasurementFeatureReference): MeasurementFeature | null;
//# sourceMappingURL=measurement.d.ts.map