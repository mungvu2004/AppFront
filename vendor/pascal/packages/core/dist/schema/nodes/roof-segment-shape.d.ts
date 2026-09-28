import { type RoofType } from './roof-segment.js';
export type RoofShapeFaceVertex = {
    x: number;
    y: number;
    z: number;
};
export type RoofShapeEaveSide = '+X' | '-X' | '+Z' | '-Z';
export declare function getRoofShapeEaveSides(type: RoofType): RoofShapeEaveSide[];
export type RoofShapeInsets = {
    iF?: number;
    iB?: number;
    iL?: number;
    iR?: number;
    dutchI?: number;
};
export type RoofShapeRatios = {
    gambrelLowerWidthRatio: number;
    mansardSteepWidthRatio: number;
    dutchHipWidthRatio: number;
    dutchHipHeightRatio: number;
    dutchWaistLengthRatio: number;
    dutchGabletRake: number;
};
export declare function getRoofShapeRatios(input: {
    gambrelLowerWidthRatio?: number;
    mansardSteepWidthRatio?: number;
    dutchHipWidthRatio?: number;
    dutchHipHeightRatio?: number;
    dutchWaistLengthRatio?: number;
    dutchGabletRake?: number;
}): RoofShapeRatios;
export type DutchRoofShapeMetrics = {
    axis: 'width' | 'depth';
    inset: number;
    middleHeight: number;
    peakHeight: number;
    rakeReach: number;
    innerWaistHalfX: number;
    innerWaistHalfZ: number;
    outerWaistHalfX: number;
    outerWaistHalfZ: number;
};
export declare function getDutchRoofShapeMetrics(input: {
    w: number;
    d: number;
    wh: number;
    rh: number;
    dutchI?: number;
    baseW: number;
    baseD: number;
    shapeRatios: RoofShapeRatios;
}): DutchRoofShapeMetrics | null;
export declare function getRoofShapeInsets(input: {
    roofType: RoofType;
    width: number;
    depth: number;
    wh: number;
    baseY: number;
    isVoid: boolean;
    brushW: number;
    brushD: number;
    tanTheta: number;
    shingleThickness: number;
    dutchHipWidthRatio: number;
}): RoofShapeInsets;
export declare function getDutchEndSlopeFaces(input: {
    w: number;
    d: number;
    wh: number;
    rh: number;
    insets: RoofShapeInsets;
    baseW: number;
    baseD: number;
    shapeRatios: RoofShapeRatios;
    dutchTopRakeThickness?: number;
}): RoofShapeFaceVertex[][];
export declare function getRoofModuleFaces(input: {
    type: RoofType;
    w: number;
    d: number;
    wh: number;
    rh: number;
    baseY: number;
    insets: RoofShapeInsets;
    baseW: number;
    baseD: number;
    tanTheta: number;
    shapeRatios: RoofShapeRatios;
    excludeDutchEndSlopes?: boolean;
    dutchTopRakeThickness?: number;
    conicalStartAngle?: number;
    conicalSweepAngle?: number;
}): RoofShapeFaceVertex[][];
//# sourceMappingURL=roof-segment-shape.d.ts.map