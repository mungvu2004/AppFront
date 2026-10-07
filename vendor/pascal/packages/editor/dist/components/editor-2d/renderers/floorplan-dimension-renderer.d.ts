import type { FloorplanGeometry, FloorplanPoint } from '@pascal-app/core';
type FloorplanDimensionRenderMode = 'screen' | 'pdf';
/**
 * Click-to-type dimensions (WS3).
 *
 * On screen the label plate carries an invisible hit rect plus the data the
 * editing layer needs to drive geometry from a typed value. The layer picks
 * it up by DOM delegation (`FloorplanDimensionEditOverlay` below), so every
 * producer of `dimension` / `dimension-string` geometry — wall automatic
 * dimensions, contextual dimensions, manual construction-dimension nodes —
 * becomes editable without each one wiring up a callback.
 *
 * Witness points are the measured feature points in level-plan metres; the
 * value is the length the label actually reads (dimension-line points when
 * the producer supplied them, witness points otherwise).
 */
export declare const FLOORPLAN_DIMENSION_HIT_ATTRIBUTE = "data-floorplan-dimension-hit";
type DimensionGeometry = Extract<FloorplanGeometry, {
    kind: 'dimension';
}>;
type DimensionStringGeometry = Extract<FloorplanGeometry, {
    kind: 'dimension-string';
}>;
export type ArchitecturalDimensionLayout = {
    dimensionStart: FloorplanPoint;
    dimensionEnd: FloorplanPoint;
    dimensionLineStart: FloorplanPoint;
    dimensionLineEnd: FloorplanPoint;
    extensionStart: FloorplanPoint;
    extensionEnd: FloorplanPoint;
    extensionStartTip: FloorplanPoint;
    extensionEndTip: FloorplanPoint;
    tickHalfVector: FloorplanPoint;
    labelPoint: FloorplanPoint;
    labelAngleDeg: number;
    labelPlacement: 'inside' | 'outside-end';
    outsideStartLabelPoint?: FloorplanPoint;
    outsideStartDimensionLineStart?: FloorplanPoint;
};
export declare function floorplanDimensionAnnotationPriority(offsetDistance: number): number;
export declare function computeArchitecturalDimensionLayout(geometry: DimensionGeometry, sceneRotationDeg: number, annotationUnitsPerPoint?: number): ArchitecturalDimensionLayout | null;
export declare function FloorplanDimensionRenderer({ geometry, sceneRotationDeg, stroke, annotationUnitsPerPoint, renderMode, onSelect, }: {
    geometry: DimensionGeometry;
    sceneRotationDeg?: number;
    stroke?: string;
    annotationUnitsPerPoint?: number;
    renderMode?: FloorplanDimensionRenderMode;
    onSelect?: () => void;
}): React.ReactElement | null;
export declare function FloorplanDimensionStringRenderer({ geometry, sceneRotationDeg, stroke, annotationUnitsPerPoint, renderMode, }: {
    geometry: DimensionStringGeometry;
    sceneRotationDeg?: number;
    stroke?: string;
    annotationUnitsPerPoint?: number;
    renderMode?: FloorplanDimensionRenderMode;
}): React.ReactElement | null;
export {};
//# sourceMappingURL=floorplan-dimension-renderer.d.ts.map