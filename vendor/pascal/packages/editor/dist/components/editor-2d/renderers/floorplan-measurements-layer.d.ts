export type LinearMeasurementOverlay = {
    dashedExtensions?: boolean;
    id: string;
    dimensionPathEnd?: string | null;
    dimensionPathStart?: string | null;
    dimensionLineEnd: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    dimensionLineStart: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    extensionStart: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    extensionEnd: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    };
    label: string;
    labelX: number;
    labelY: number;
    labelAngleDeg: number;
    extensionStroke?: string;
    isSelected?: boolean;
    labelFill?: string;
    showTicks?: boolean;
    stroke?: string;
};
type FloorplanMeasurementPalette = {
    measurementStroke: string;
};
type FloorplanMeasurementsLayerProps = {
    className: string;
    measurements: LinearMeasurementOverlay[];
    palette: FloorplanMeasurementPalette;
    sceneRotationDeg?: number;
};
export declare const FloorplanMeasurementsLayer: import("react").MemoExoticComponent<({ className, measurements, palette, sceneRotationDeg, }: FloorplanMeasurementsLayerProps) => import("react").JSX.Element | null>;
export {};
//# sourceMappingURL=floorplan-measurements-layer.d.ts.map