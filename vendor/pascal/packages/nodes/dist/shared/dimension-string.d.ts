import type { DimensionTerminator, DimensionTextPosition, FloorplanGeometry, FloorplanPoint } from '@pascal-app/core';
export type DimensionStringSegment = {
    witnessStart: FloorplanPoint;
    witnessEnd: FloorplanPoint;
    dimensionStart?: FloorplanPoint;
    dimensionEnd?: FloorplanPoint;
    text: string;
};
export type DimensionStringGeometryInput = {
    segments: readonly DimensionStringSegment[];
    offsetNormal: FloorplanPoint;
    offsetDistance?: number;
    extensionStartGap?: number;
    extensionOvershoot?: number;
    terminator?: DimensionTerminator;
    textPosition?: DimensionTextPosition;
    stroke?: string;
};
export declare function buildDimensionStringGeometry(input: DimensionStringGeometryInput): FloorplanGeometry;
//# sourceMappingURL=dimension-string.d.ts.map