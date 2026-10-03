import { type MeasurementAnchor, type MeasurementPayload, type MeasurementPoint } from '@pascal-app/core';
import type { ResolvedMeasurementPayload } from './resolve';
export declare function measurementResolvedEditPoints(measurement: ResolvedMeasurementPayload): MeasurementPoint[];
export declare function refreshMeasurementAnchorFallbacks(measurement: MeasurementPayload, resolved: ResolvedMeasurementPayload): MeasurementPayload;
export declare function replaceMeasurementAnchor(measurement: MeasurementPayload, index: number, anchor: MeasurementAnchor): MeasurementPayload | null;
export declare function constrainMeasurementSpatialEditPoint(measurement: ResolvedMeasurementPayload, point: MeasurementPoint): MeasurementPoint;
export declare function constrainMeasurementPlanEditPoint(measurement: ResolvedMeasurementPayload, index: number, planPoint: readonly [number, number]): MeasurementPoint | null;
export declare function measurementEditAnchor(measurement: ResolvedMeasurementPayload, point: MeasurementPoint, associatedAnchor?: MeasurementAnchor): MeasurementAnchor;
//# sourceMappingURL=edit.d.ts.map