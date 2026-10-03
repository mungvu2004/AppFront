import type { BlockCommand } from './commands';
import { type BlockModalFeedbackMode } from './modal-transform';
export type BlockModalFaceOperation = 'extrude' | 'inset';
export type BlockExtrudeAxis = 'normal' | 'x' | 'y' | 'z';
type BlockPointerClientPosition = {
    x: number;
    y: number;
};
export declare function blockFaceOperationValueFromPointer(operation: BlockModalFaceOperation, startPointer: BlockPointerClientPosition, currentPointer: BlockPointerClientPosition, pivot: BlockPointerClientPosition, topologyExtent: number, projectedExtentPixels: number, extrusionDirection?: BlockPointerClientPosition | null): number;
export declare function blockFaceOperationCommand(operation: BlockModalFaceOperation, faceIds: string[], value: number, extrudeAxis?: BlockExtrudeAxis): BlockCommand;
export declare function blockModalFaceOperationStatus(operation: BlockModalFaceOperation, value: string, feedbackMode?: BlockModalFeedbackMode, extrudeAxis?: BlockExtrudeAxis): string;
export {};
//# sourceMappingURL=modal-face-operation.d.ts.map