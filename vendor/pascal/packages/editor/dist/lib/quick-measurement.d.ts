import { type AnyNode, type AnyNodeId, type GeometryContext, type QuickMeasurementReport } from '@pascal-app/core';
export declare function createQuickMeasurementPointerScheduler(onPointerMove: (event: PointerEvent) => void, frameDriver?: {
    request: (callback: FrameRequestCallback) => number;
    cancel: (frameId: number) => void;
}): {
    enqueue: (event: PointerEvent) => void;
    clear: () => void;
};
export declare function quickMeasurementContext(node: AnyNode, nodes: Record<AnyNodeId, AnyNode>): GeometryContext;
export declare function resolveQuickMeasurementReport(nodeId: string | null, nodes: Record<AnyNodeId, AnyNode>): QuickMeasurementReport | null;
//# sourceMappingURL=quick-measurement.d.ts.map