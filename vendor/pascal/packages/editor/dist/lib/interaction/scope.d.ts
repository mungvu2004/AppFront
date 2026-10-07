import type { AnyNode } from '@pascal-app/core';
export type InteractionView = '2d' | '3d';
export type ReshapeDriver = 'tool' | 'floorplan';
export type ReshapeKind = 'curve' | 'hole' | 'endpoint' | 'boundary' | 'control-point' | 'tangent' | 'split';
export type InteractionScope = {
    kind: 'idle';
} | {
    kind: 'placing';
    node: AnyNode;
    nodeId: string;
    nodeType: string;
    view: InteractionView;
    pressDrag: boolean;
    driver: 'move-tool' | 'registry-tool';
} | {
    kind: 'moving';
    node: AnyNode;
    nodeId: string;
    nodeType: string;
    view: InteractionView;
} | {
    kind: 'handle-drag';
    nodeId: string;
    handle: string;
} | {
    kind: 'mesh-editing';
    nodeId: string;
    phase: 'selecting' | 'operating';
    operator?: 'translate' | 'rotate' | 'scale' | 'extrude' | 'inset' | 'merge' | 'dissolve' | 'loop-cut' | 'bevel' | 'delete';
} | {
    kind: 'drafting';
    tool: string;
} | {
    kind: 'reshaping';
    nodeId: string;
    reshape: ReshapeKind;
    driver: ReshapeDriver;
    holeIndex?: number;
    endpoint?: 'start' | 'end';
    index?: number;
    side?: 'in' | 'out';
} | {
    kind: 'box-select';
} | {
    kind: 'painting';
} | {
    kind: 'sculpting';
};
export type InteractionKind = InteractionScope['kind'];
export type ActiveInteractionScope = Exclude<InteractionScope, {
    kind: 'idle';
}>;
export declare const IDLE_SCOPE: InteractionScope;
export declare function isIdle(scope: InteractionScope): scope is {
    kind: 'idle';
};
export declare function isActive(scope: InteractionScope): scope is ActiveInteractionScope;
export declare function scopeNodeId(scope: InteractionScope): string | null;
export declare function movingNodeOf(scope: InteractionScope): AnyNode | null;
export declare function selectionEnabled(scope: InteractionScope): boolean;
export declare function meshEditScope(nodeId: string, phase?: 'selecting' | 'operating', operator?: Extract<InteractionScope, {
    kind: 'mesh-editing';
}>['operator']): ActiveInteractionScope;
export declare function handleDragInfo(scope: InteractionScope): {
    nodeId: string;
    label: string;
} | null;
export declare function editingHoleInfo(scope: InteractionScope): {
    nodeId: string;
    holeIndex: number;
} | null;
export declare function holeEditScope(target: {
    nodeId: string;
    holeIndex: number;
    driver?: ReshapeDriver;
}): ActiveInteractionScope;
export declare function isCurveReshape(scope: InteractionScope): boolean;
export declare function isToolDrivenReshape(scope: InteractionScope): boolean;
export declare function isFloorplanDrivenReshape(scope: InteractionScope): boolean;
export declare function endpointReshapeInfo(scope: InteractionScope): {
    nodeId: string;
    endpoint: 'start' | 'end';
} | null;
export declare function controlPointReshapeInfo(scope: InteractionScope): {
    nodeId: string;
    index: number;
} | null;
export declare function tangentReshapeInfo(scope: InteractionScope): {
    nodeId: string;
    index: number;
    side: 'in' | 'out';
} | null;
export declare function reshapingNodeId(scope: InteractionScope): string | null;
export declare function curveReshapeScope(nodeId: string, driver?: ReshapeDriver): ActiveInteractionScope;
export declare function endpointReshapeScope(nodeId: string, endpoint: 'start' | 'end', driver?: ReshapeDriver): ActiveInteractionScope;
export declare function controlPointReshapeScope(nodeId: string, index: number, driver?: ReshapeDriver): ActiveInteractionScope;
export declare function tangentReshapeScope(nodeId: string, index: number, side: 'in' | 'out', driver?: ReshapeDriver): ActiveInteractionScope;
export declare function boundaryReshapeScope(nodeId: string, driver?: ReshapeDriver): ActiveInteractionScope;
//# sourceMappingURL=scope.d.ts.map