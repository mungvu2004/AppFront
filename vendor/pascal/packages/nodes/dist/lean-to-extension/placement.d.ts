import { type AnyNode, type AnyNodeId, LeanToExtensionNode, type SlabNode, type WallNode } from '@pascal-app/core';
import { type LeanToCornerSide } from './corner-joint';
export type LeanToPlanPlacementTarget = {
    node: LeanToExtensionNode;
    valid: boolean;
    wall?: WallNode;
};
export declare function resolveLeanToCommitTarget<T>(visibleTarget: T | null, clickTarget: T | null): T | null;
/** Apply transient corner data so the placement ghost matches the committed assembly. */
export declare function resolveLeanToPreviewNode(node: LeanToExtensionNode, wall: WallNode | undefined, nodes: Record<AnyNodeId, AnyNode>): LeanToExtensionNode;
export declare function resolveLeanToWallPlanTarget(wall: WallNode, localX: number, side: 'front' | 'back', nodes: Record<AnyNodeId, AnyNode>): LeanToPlanPlacementTarget | null;
export declare const LEAN_TO_RUN_MAGNETIC_SNAP_RADIUS = 0.5;
export declare const LEAN_TO_RUN_CONNECT_SNAP_RADIUS = 0.5;
export declare function nextLeanToPlacementRotation(current: number, key: string, hasShortcutModifier?: boolean): number;
export declare function resolveLeanToPlanPosition(node: LeanToExtensionNode, point: readonly [number, number]): LeanToExtensionNode['position'];
export declare function resolveLeanToFreestandingPlacement(levelId: string, point: readonly [number, number], rotationY?: number, canopyForm?: LeanToExtensionNode['canopyForm']): LeanToExtensionNode;
export declare function resolveLeanToFreestandingRunPlacement(levelId: string, start: readonly [number, number], end: readonly [number, number], flipProjection?: boolean, canopyForm?: LeanToExtensionNode['canopyForm']): LeanToExtensionNode | null;
export type LeanToFreestandingRunEndpointSnap = {
    nodeId: string;
    point: [number, number];
    side: LeanToCornerSide;
};
export declare function resolveLeanToFreestandingRunEndpointSnap({ activeLevelId, canopyForm, flipProjection, maxDistance, nodes, proposedEnd, start, }: {
    activeLevelId: AnyNodeId;
    canopyForm?: LeanToExtensionNode['canopyForm'];
    flipProjection?: boolean;
    maxDistance?: number;
    nodes: Record<AnyNodeId, AnyNode>;
    proposedEnd: readonly [number, number];
    start: readonly [number, number];
}): LeanToFreestandingRunEndpointSnap | null;
export declare function resolveLeanToFreestandingRunTarget({ activeLevelId, canopyForm, end, flipProjection, nodes, start, }: {
    activeLevelId: AnyNodeId;
    canopyForm?: LeanToExtensionNode['canopyForm'];
    end: readonly [number, number];
    flipProjection?: boolean;
    nodes: Record<AnyNodeId, AnyNode>;
    start: readonly [number, number];
}): LeanToPlanPlacementTarget | null;
export declare function resolveLeanToPlanPlacement({ activeLevelId, freestandingPoint, freestandingRotationY, freestandingCanopyForm, nodes, point, }: {
    activeLevelId: AnyNodeId;
    freestandingPoint: readonly [number, number];
    freestandingRotationY?: number;
    freestandingCanopyForm?: LeanToExtensionNode['canopyForm'];
    nodes: Record<AnyNodeId, AnyNode>;
    point: readonly [number, number];
}): LeanToPlanPlacementTarget;
export declare function nextLeanToCanopyForm(current: LeanToExtensionNode['canopyForm'], key: string): LeanToExtensionNode['canopyForm'];
export declare function resolveLeanToSlabEdgePlacement({ activeLevelId, edgeIndex, edgeT, nodes, slab, }: {
    activeLevelId: string;
    edgeIndex: number;
    edgeT: number;
    nodes: Record<AnyNodeId, AnyNode>;
    slab: SlabNode;
}): LeanToExtensionNode | null;
export declare function findLeanToSlabEdgePlacement(point: readonly [number, number], nodes: Record<AnyNodeId, AnyNode>, activeLevelId: string, maxDistance?: number): LeanToExtensionNode | null;
export declare function reconcileLeanToSlabEdgePlacement(node: LeanToExtensionNode, nodes: Record<AnyNodeId, AnyNode>): LeanToExtensionNode;
export declare function moveLeanToAlongSlabEdge(node: LeanToExtensionNode, point: readonly [number, number], nodes: Record<AnyNodeId, AnyNode>): LeanToExtensionNode | null;
//# sourceMappingURL=placement.d.ts.map