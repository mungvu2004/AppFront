import type { MeasurementFeature } from '@pascal-app/core';
type PolygonPoint = readonly [number, number];
export declare function polygonMeasurementFeatures({ featurePrefix, height, label, polygon, }: {
    featurePrefix: string;
    height: number;
    label: string;
    polygon: readonly PolygonPoint[];
}): MeasurementFeature[];
export {};
//# sourceMappingURL=polygon-measurement.d.ts.map