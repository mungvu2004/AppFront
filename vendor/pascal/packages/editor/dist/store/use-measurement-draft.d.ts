import { type MeasurementAnchor, type MeasurementFeatureAnchor, MeasurementNode, type MeasurementSnapKind } from '@pascal-app/core';
export type MeasurementKind = 'distance' | 'angle' | 'area' | 'perimeter' | 'volume';
export type MeasurementDraftOwner = '2d' | '3d';
export type MeasurementDraftStage = 'collecting' | 'extruding' | 'ready';
export type MeasurementAxis = 'x' | 'y' | 'z';
export type MeasurementPoint = [number, number, number];
export type MeasurementAxisGuide = {
    axis: MeasurementAxis;
    from: MeasurementPoint;
    to: MeasurementPoint;
    snapped: boolean;
    proximity?: boolean;
};
export type MeasurementSurfacePoint = {
    point: MeasurementPoint;
    normal: MeasurementPoint;
    targetNodeId: string | null;
    anchor?: MeasurementFeatureAnchor;
    semantic?: {
        label: string;
        length: number | null;
        snapKind: MeasurementSnapKind;
    };
};
export type MeasurementVertexDrag = {
    owner: MeasurementDraftOwner;
    index: number;
    originalPoint: MeasurementPoint;
    originalAnchor: MeasurementFeatureAnchor | null;
    inserted: boolean;
};
export type MeasurementDraftPayload = {
    kind: 'distance';
    points: [MeasurementAnchor, MeasurementAnchor];
} | {
    kind: 'angle';
    points: [MeasurementAnchor, MeasurementAnchor, MeasurementAnchor];
} | {
    kind: 'area';
    base: MeasurementAnchor[];
} | {
    kind: 'perimeter';
    base: MeasurementAnchor[];
} | {
    kind: 'volume';
    base: MeasurementAnchor[];
    extrusion: MeasurementPoint;
};
type MeasurementDraftState = {
    kind: MeasurementKind;
    owner: MeasurementDraftOwner | null;
    levelId: string | null;
    stage: MeasurementDraftStage;
    points: MeasurementPoint[];
    anchors: Array<MeasurementFeatureAnchor | null>;
    hover: MeasurementSurfacePoint | null;
    hoverOwner: MeasurementDraftOwner | null;
    axisGuide: MeasurementAxisGuide | null;
    vertexDrag: MeasurementVertexDrag | null;
    collectionPlane: {
        point: MeasurementPoint;
        normal: MeasurementPoint;
    } | null;
    baseNormal: MeasurementPoint | null;
    extrusionHeight: number;
    error: string | null;
    setKind(kind: MeasurementKind): void;
    setHover(owner: MeasurementDraftOwner, hover: MeasurementSurfacePoint | null, axisGuide?: MeasurementAxisGuide | null): void;
    beginVertexDrag(owner: MeasurementDraftOwner, index: number): boolean;
    beginMidpointVertexDrag(owner: MeasurementDraftOwner, edgeIndex: number): boolean;
    updateDraggedVertex(owner: MeasurementDraftOwner, hover: MeasurementSurfacePoint, axisGuide?: MeasurementAxisGuide | null): boolean;
    finishVertexDrag(owner: MeasurementDraftOwner): boolean;
    cancelVertexDrag(owner: MeasurementDraftOwner): boolean;
    addPoint(owner: MeasurementDraftOwner, point: MeasurementPoint, anchor?: MeasurementFeatureAnchor, surfaceNormal?: MeasurementPoint): boolean;
    closeBase(owner: MeasurementDraftOwner, preferredNormal?: MeasurementPoint): boolean;
    setExtrusionHeight(owner: MeasurementDraftOwner, height: number): boolean;
    finishExtrusion(owner: MeasurementDraftOwner): boolean;
    removeLast(owner: MeasurementDraftOwner): boolean;
    getCommitPayload(owner: MeasurementDraftOwner): MeasurementDraftPayload | null;
    reset(): void;
};
export declare function measurementPolygonMidpoints(points: readonly MeasurementPoint[]): Array<{
    edgeIndex: number;
    point: MeasurementPoint;
}>;
export declare const useMeasurementDraft: import("zustand").UseBoundStore<import("zustand").StoreApi<MeasurementDraftState>>;
export declare function commitMeasurementDraft(owner: MeasurementDraftOwner): MeasurementNode['id'] | null;
export declare function finishMeasurementDraft(owner: MeasurementDraftOwner, preferredNormal?: MeasurementPoint): boolean;
export declare function handleMeasurementDraftEscape(owner: MeasurementDraftOwner, preferredNormal?: MeasurementPoint): boolean;
export {};
//# sourceMappingURL=use-measurement-draft.d.ts.map