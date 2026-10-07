export type BlockTransformAxis = 'x' | 'y' | 'z';
export type BlockTransformPlane = 'xy' | 'xz' | 'yz';
export type BlockTransformOperation = 'translate' | 'rotate' | 'scale';
export type BlockTransformConstraint = BlockTransformAxis | BlockTransformPlane | 'free' | 'uniform';
export type BlockModalFeedbackMode = 'free' | 'grid' | 'angle' | 'exact' | 'geometry';
export type BlockActiveTransform = {
    operation: BlockTransformOperation;
    constraint: BlockTransformConstraint;
};
export type BlockAxisVisualState = 'normal' | 'active' | 'faded';
export type BlockScreenPoint = {
    x: number;
    y: number;
};
export declare function blockRotationPointerAngle(pivot: BlockScreenPoint, start: BlockScreenPoint, current: BlockScreenPoint): number;
export declare function blockTransformAxisFromKey(key: string): BlockTransformAxis | null;
export declare function blockTransformConstraintFromKey(key: string, planeLock: boolean): BlockTransformAxis | BlockTransformPlane | null;
export declare function blockTransformNumericInputFromKey(current: string, key: string): string | null;
export declare function blockTransformNumericValue(input: string, operation: BlockTransformOperation): number | null;
export declare function blockTransformDisplayValue(operation: BlockTransformOperation, value: number): string;
export declare function blockModalFeedbackLabel(mode: BlockModalFeedbackMode): string;
export declare function blockAxisDelta(axis: BlockTransformAxis, distance: number): [number, number, number];
export declare function blockPointerDistanceForAxis(_axis: BlockTransformAxis, distance: number): number;
export declare function blockConstrainTranslationDelta(delta: [number, number, number], constraint: BlockTransformConstraint): [number, number, number];
export declare function blockNumericDeltaForConstraint(constraint: BlockTransformConstraint, pointerDelta: [number, number, number], distance: number): [number, number, number];
export declare function blockScaleFactorsForConstraint(constraint: BlockTransformConstraint, factor: number): [number, number, number];
export declare function blockAxisVisualState(activeTransform: BlockActiveTransform | null, operation: BlockTransformOperation, axis: BlockTransformAxis): BlockAxisVisualState;
export declare function blockPlaneVisualState(activeTransform: BlockActiveTransform | null, plane: BlockTransformPlane): BlockAxisVisualState;
export declare function blockModalTransformStatus(activeTransform: BlockActiveTransform, typedInput?: string, feedbackMode?: BlockModalFeedbackMode): string;
//# sourceMappingURL=modal-transform.d.ts.map