export type BlockToolbarMode = 'vertex' | 'edge' | 'face';
export type BlockScaleAxis = 'uniform' | 'x' | 'y' | 'z';
export type BlockTransformTool = 'transform' | 'loop-cut' | 'bevel';
export type BlockOperationAvailability = {
    extrude: boolean;
    inset: boolean;
    merge: boolean;
    dissolve: boolean;
    bevel: boolean;
};
export type BlockGizmoDimensions = {
    length: number;
    radius: number;
    rotationRadius: number;
    planeHandleSize: number;
    planeHandleOffset: number;
};
export type BlockGizmoHitDimensions = {
    axisRadius: number;
    scaleRadius: number;
    planeSize: number;
    rotationTube: number;
    rotationArc: number;
    rotationStart: number;
};
export declare function blockOperationAvailability(mode: BlockToolbarMode, selectedCount: number): BlockOperationAvailability;
export declare function formatBlockSelectionStatus(mode: BlockToolbarMode, selectedCount: number): string;
export declare function blockComponentStatus({ mode, selectedCount, tool, loopCutCount, loopCutFactor, bevelSegments, bevelWidth, }: {
    mode: BlockToolbarMode;
    selectedCount: number;
    tool: BlockTransformTool;
    loopCutCount: number;
    loopCutFactor: number;
    bevelSegments: number;
    bevelWidth: number;
}): string | null;
export declare function blockScaleFactors(axis: BlockScaleAxis, factor: number): [number, number, number];
export declare function blockScaleFactorFromDrag(distance: number, handleLength: number, snapStep?: number): number;
export declare function blockGizmoDimensions(_topologyExtent: number): BlockGizmoDimensions;
export declare function blockGizmoHitDimensions(radius: number, planeHandleSize: number): BlockGizmoHitDimensions;
export declare function blockToolbarOffset(topologyExtent: number, gizmoLength: number): number;
export declare function blockBevelWidthFromDrag(deltaX: number, deltaY: number, { topologyExtent, projectedExtentPixels, }: {
    topologyExtent: number;
    projectedExtentPixels: number;
}): number;
//# sourceMappingURL=toolbar-state.d.ts.map