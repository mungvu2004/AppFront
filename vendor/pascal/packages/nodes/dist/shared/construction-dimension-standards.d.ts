import type { DimensionTerminator, DimensionTextPosition } from '@pascal-app/core';
import type { ConstructionImperialPrecision, ConstructionMetricNotation } from './construction-length';
export type ConstructionDimensionDrawingStandard = {
    datumPolicy: 'centerline' | 'wall-face' | 'structural-face' | 'finish-face';
    intersectionReferencePolicy: 'single' | 'both-faces';
    terminator: DimensionTerminator;
    textPosition: DimensionTextPosition;
    imperialPrecision: ConstructionImperialPrecision;
    metricNotation: ConstructionMetricNotation;
    openingChainOffset: number;
    wallSpanOffset: number;
    firstOpeningWidthOffset: number;
    firstGeneralTierOffset: number;
    tierSpacing: number;
    extensionStartGap: number;
    extensionOvershoot: number;
};
export declare const DEFAULT_CONSTRUCTION_DIMENSION_STANDARD: {
    datumPolicy: "wall-face";
    intersectionReferencePolicy: "single";
    terminator: "architectural-tick";
    textPosition: "above";
    imperialPrecision: "1/16";
    metricNotation: "meters";
    openingChainOffset: number;
    wallSpanOffset: number;
    firstOpeningWidthOffset: number;
    firstGeneralTierOffset: number;
    tierSpacing: number;
    extensionStartGap: number;
    extensionOvershoot: number;
};
export declare function constructionDimensionStandard(overrides?: Partial<ConstructionDimensionDrawingStandard>): ConstructionDimensionDrawingStandard;
//# sourceMappingURL=construction-dimension-standards.d.ts.map