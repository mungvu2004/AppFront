import type { ColumnNode } from '@pascal-app/core';
export declare function getSegments(node: ColumnNode): 8 | 16 | 32;
export declare function getShaftSegmentCount(node: ColumnNode): number;
export declare function getShaftTwistRadians(node: ColumnNode, index: number): number;
export declare function getShaftScaleAt(node: ColumnNode, t: number): number;
export declare function columnShaftLayout(node: ColumnNode): {
    baseHeight: number;
    capitalHeight: number;
    shaftY: number;
    shaftHeight: number;
};
export type CapitalBlock = {
    kind: 'box' | 'round' | 'oval' | 'column';
    y: number;
    height: number;
    width?: number;
    depth?: number;
    radius?: number;
    scale?: number;
};
export declare function columnCapitalBlocks(node: ColumnNode, y: number, height: number): CapitalBlock[];
//# sourceMappingURL=shape.d.ts.map