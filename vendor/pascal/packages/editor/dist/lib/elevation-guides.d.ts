import { type AnyNode, type FenceNode } from '@pascal-app/core';
export declare const ELEVATION_ALIGNMENT_THRESHOLD_M = 0.08;
export type ElevationGuideSource = {
    nodeId: string;
    levelId: string | null | undefined;
    anchor: readonly [number, number];
};
export type ElevationSnapTarget = {
    id: string;
    elevation: number;
    anchor: readonly [number, number];
    label: string;
};
export type ElevationSnapMatch = {
    target: ElevationSnapTarget;
    elevation: number;
};
export declare function getFenceBaseElevationForNodes(node: FenceNode, nodes: Record<string, AnyNode>): number;
/**
 * Structural Y datums on the source node's level. This is editor-runtime
 * collection over authoritative vertical resolvers; matching remains a pure
 * scalar operation in {@link resolveElevationSnapMatch}.
 */
export declare function collectElevationSnapTargets(source: ElevationGuideSource, nodes: Record<string, AnyNode>): ElevationSnapTarget[];
export declare function resolveElevationSnapMatch(proposedElevation: number, sourceAnchor: readonly [number, number], targets: readonly ElevationSnapTarget[], threshold?: number): ElevationSnapMatch | null;
export declare function resolveStructuralElevationSnap(source: ElevationGuideSource, proposedElevation: number, nodes: Record<string, AnyNode>): number;
export declare function publishStructuralElevationGuide(source: ElevationGuideSource, elevation: number, nodes: Record<string, AnyNode>): void;
export declare function publishResolvedElevationGuide(source: ElevationGuideSource, target: ElevationSnapTarget): void;
export declare function clearStructuralElevationGuide(ownerId: string): void;
//# sourceMappingURL=elevation-guides.d.ts.map