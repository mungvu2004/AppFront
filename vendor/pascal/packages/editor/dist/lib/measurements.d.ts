import type { MeasurementPoint } from '@pascal-app/core';
export type LinearUnit = 'metric' | 'imperial';
export type MetricNotation = 'meters' | 'millimeters';
export declare const MEASUREMENT_ACTIVE_COLOR = "#6366f1";
export declare const MEASUREMENT_DANGLING_COLOR = "#dc2626";
export declare const MEASUREMENT_FLOORPLAN_COLOR = "#4f46e5";
export declare const MEASUREMENT_PERSISTENT_COLOR = "#111827";
export declare function measurementPresentationColor(dangling: boolean, active: boolean): string;
export declare function measurementFloorplanPresentationColor(dangling: boolean, active: boolean): string;
type MeasurementAngleArcOptions = {
    radius?: number;
    sampleCount?: number;
};
export declare function buildMeasurementAngleArcPoints(start: MeasurementPoint, vertex: MeasurementPoint, end: MeasurementPoint, options?: MeasurementAngleArcOptions): MeasurementPoint[];
type LinearControlValueOptions = {
    minMeters?: number;
    maxMeters?: number;
};
export declare function metersToLinearUnit(meters: number, unit: LinearUnit): number;
export declare function linearUnitToMeters(value: number, unit: LinearUnit): number;
export declare function linearControlValueToMeters(value: number, unit: LinearUnit, options?: LinearControlValueOptions): number;
export declare function getLinearUnitLabel(unit: LinearUnit): string;
export declare function squareMetersToAreaUnit(squareMeters: number, unit: LinearUnit): number;
export declare function getAreaUnitLabel(unit: LinearUnit): string;
export declare function formatAreaLabel(squareMeters: number, unit: LinearUnit, fractionDigits?: number): string;
export declare function cubicMetersToVolumeUnit(cubicMeters: number, unit: LinearUnit): number;
export declare function getVolumeUnitLabel(unit: LinearUnit): string;
export declare function formatVolumeLabel(cubicMeters: number, unit: LinearUnit, fractionDigits?: number): string;
export declare function formatLinearMeasurement(meters: number, unit: LinearUnit, metricNotation?: MetricNotation): string;
export {};
//# sourceMappingURL=measurements.d.ts.map