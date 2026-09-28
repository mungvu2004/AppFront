import { type AnyNode, type AnyNodeId, LeanToExtensionNode, type WallNode } from '@pascal-app/core';
import { type LeanToArcFrame } from './arc';
export declare const MIN_LEAN_TO_POST_HEIGHT = 0.2;
export declare const MIN_LEAN_TO_WALL_LENGTH = 0.6;
export declare const LEAN_TO_EXTENSION_GEOMETRY_REVISION = 8;
export declare const LEAN_TO_EDGE_SNAP_TOLERANCE = 0.25;
export declare const LEAN_TO_HEIGHT_SNAP_TOLERANCE = 0.15;
export declare function isDualSlopeLeanToCanopy(form: LeanToExtensionNode['canopyForm']): boolean;
export type LeanToLayout = {
    canopyForm: LeanToExtensionNode['canopyForm'];
    span: number;
    projection: number;
    roofRun: number;
    roofWidth: number;
    roofCenterX: number;
    slopeLength: number;
    rafterSlopeLength: number;
    pitchRadians: number;
    effectivePitchDegrees: number;
    highEdgeHeight: number;
    lowEdgeHeight: number;
    eaveEdgeHeight: number;
    roofCenterY: number;
    roofCenterZ: number;
    rafterCenterY: number;
    rafterCenterZ: number;
    beamSpan: number;
    beamCenterY: number;
    beamZ: number;
    oppositeBeamZ: number;
    postHeight: number;
    postXs: number[];
    rafterXs: number[];
    postFrames: LeanToArcFrame[];
    rafterFrames: LeanToArcFrame[];
};
export declare function leanToLowEdgeHeight(node: Pick<LeanToExtensionNode, 'highEdgeHeight' | 'pitch' | 'projection'>): number;
export declare function resolveLeanToWallSurfaceHit(wall: WallNode, localPosition: readonly [number, number, number], normal: readonly [number, number, number] | undefined): {
    localX: number;
    side: 'front' | 'back';
} | null;
export declare function applyLeanToCurveProjectionLimit(node: LeanToExtensionNode): LeanToExtensionNode;
export declare function resolveLeanToLayout(node: LeanToExtensionNode): LeanToLayout;
/**
 * Plan-space center of the rendered lean-to footprint, measured from the node
 * origin. Placement tools use this shared offset so the pointer marks the
 * center of the whole footprint rather than the high-edge origin.
 */
export declare function resolveLeanToPlanCenter(node: LeanToExtensionNode): [number, number];
export declare function resolveLeanToSpanArc(wall: WallNode, node: Pick<LeanToExtensionNode, 'position' | 'rotation'>): {
    centerZ: number;
    radius: number;
} | null;
export declare function resolveLeanToMoveCenterX(node: LeanToExtensionNode, wall: WallNode, rawLocalX: number, snapStep?: number, edgeSnapTargets?: readonly LeanToEdgeSnapTarget[]): number;
export type LeanToMoveProposal = {
    centerX: number;
    highEdgeHeight: number;
    lowEdgeHeight: number;
};
export declare function resolveLeanToMoveProposal({ node, wall, rawLocalX, rawHighEdgeHeight, snapStep, edgeSnapTargets, }: {
    node: LeanToExtensionNode;
    wall: WallNode;
    rawLocalX: number;
    rawHighEdgeHeight: number;
    snapStep?: number;
    edgeSnapTargets?: readonly LeanToEdgeSnapTarget[];
}): LeanToMoveProposal;
export type LeanToEdgeSnapTarget = {
    leftEdgeX: number;
    rightEdgeX: number;
    roofEdgeY: number;
    pitch?: number;
    nodeId?: AnyNodeId;
    anchor?: readonly [number, number];
};
export type LeanToHeightSnapMatch = {
    highEdgeHeight: number;
    target: LeanToEdgeSnapTarget;
};
export type LeanToSpanResizeSide = 'left' | 'right';
export type LeanToSpanResizeProposal = {
    span: number;
    position: [number, number, number];
    highEdgeHeight: number;
    lowEdgeHeight: number;
    pitch: number;
    target: LeanToEdgeSnapTarget | null;
};
export declare function resolveLeanToSpanResizeProposal({ node, wall, rawSpan, side, edgeSnapTargets, tolerance, }: {
    node: LeanToExtensionNode;
    wall: WallNode;
    rawSpan: number;
    side: LeanToSpanResizeSide;
    edgeSnapTargets?: readonly LeanToEdgeSnapTarget[];
    tolerance?: number;
}): LeanToSpanResizeProposal;
export declare function resolveLeanToHighEdgeHeightSnap(node: LeanToExtensionNode, rawHighEdgeHeight: number, targets: readonly LeanToEdgeSnapTarget[], tolerance?: number): LeanToHeightSnapMatch | null;
export declare function resolveLeanToEdgeSnapTargets(node: LeanToExtensionNode, wall: WallNode, nodes: Record<AnyNodeId, AnyNode>): LeanToEdgeSnapTarget[];
export declare function resolveLeanToWallPlacement(wall: WallNode, rawLocalX: number, side: 'front' | 'back', overrides?: Partial<LeanToExtensionNode>): LeanToExtensionNode | null;
export declare function leanToWallLocalPose(wall: WallNode, node: LeanToExtensionNode, baseY: number): {
    position: [number, number, number];
    rotationY: number;
};
export declare function resolveLeanToParentPose(wall: WallNode, node: LeanToExtensionNode): {
    position: [number, number, number];
    rotationY: number;
};
//# sourceMappingURL=layout.d.ts.map