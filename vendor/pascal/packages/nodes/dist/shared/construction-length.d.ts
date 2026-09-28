export type ConstructionLinearUnit = 'metric' | 'imperial';
export type ConstructionLengthProfile = 'editor' | 'document';
export type ConstructionMetricNotation = 'meters' | 'millimeters';
export type ConstructionImperialPrecision = '1' | '1/2' | '1/4' | '1/8' | '1/16';
export type ConstructionLengthFormatOptions = {
    metricNotation?: ConstructionMetricNotation;
    imperialPrecision?: ConstructionImperialPrecision;
};
export declare function formatConstructionLength(meters: number, unit: ConstructionLinearUnit, profile?: ConstructionLengthProfile, options?: ConstructionLengthFormatOptions): string;
//# sourceMappingURL=construction-length.d.ts.map