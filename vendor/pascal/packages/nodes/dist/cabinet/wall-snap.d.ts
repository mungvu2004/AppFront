import { type AnyNode, type AnyNodeId, type CabinetModuleNode } from '@pascal-app/core';
import type { WallHit } from '../shared/wall-attach-target';
export type CabinetWallSnapNeighbor = {
    minX: number;
    maxX: number;
};
export type CabinetWallSnapPlacement = {
    position: [number, number, number];
    yaw: number;
    localX: number;
    side: WallHit['side'];
    snapReason: 'grid' | 'corner' | 'cabinet-edge';
    guide: {
        start: [number, number, number];
        end: [number, number, number];
    };
};
export type CabinetRunWallSnapPose = {
    position: [number, number, number];
    rotation: number;
};
export declare function findClosestCabinetWallInPlan({ excludeIds, fallbackToAnyYaw, nodes, parentLevelId, planPoint, yaw, }: {
    excludeIds: readonly AnyNodeId[];
    fallbackToAnyYaw?: boolean;
    nodes: Record<AnyNodeId, AnyNode>;
    parentLevelId: AnyNodeId;
    planPoint: readonly [number, number];
    yaw?: number;
}): WallHit | null;
export declare function resolveCabinetWallFaceOffset({ hit, nodes, parentLevelId, }: {
    hit: WallHit;
    nodes: Record<AnyNodeId, AnyNode>;
    parentLevelId: AnyNodeId;
}): number;
export declare function collectCabinetWallSnapNeighbors({ hit, nodes, excludeIds, parentLevelId, width, }: {
    excludeIds?: readonly AnyNodeId[];
    hit: WallHit;
    nodes: Record<AnyNodeId, AnyNode>;
    parentLevelId: AnyNodeId;
    width: number;
}): CabinetWallSnapNeighbor[];
export declare function resolveCabinetWallSnapPlacement({ depth, gridStep, faceOffset, hit, endStop, neighbors, startStop, width, }: {
    depth: number;
    endStop?: number;
    faceOffset?: number;
    gridStep?: number;
    hit: WallHit;
    neighbors?: CabinetWallSnapNeighbor[];
    startStop?: number;
    width: number;
}): CabinetWallSnapPlacement | null;
export declare function resolveCabinetWallSnapPlacementInScene({ depth, excludeIds, gridStep, hit, nodes, parentLevelId, width, }: {
    depth: number;
    excludeIds?: readonly AnyNodeId[];
    gridStep?: number;
    hit: WallHit;
    nodes: Record<AnyNodeId, AnyNode>;
    parentLevelId: AnyNodeId;
    width: number;
}): CabinetWallSnapPlacement | null;
/**
 * Wall snap for a single dragged module, in its run's LOCAL frame — the
 * frame `movable.parentFrame` kinds store `position` in. Converts the
 * candidate to plan space, resolves the same flush-to-wall placement a run
 * drag gets, and converts back. Snaps only when the module's world yaw
 * already faces the wall (a module drag cannot rotate its run).
 */
export declare function resolveCabinetModuleWallSnapLocal({ candidateLocal, excludeIds, gridStep, module, nodes, parentLevelId, run, }: {
    candidateLocal: [number, number, number];
    excludeIds?: readonly AnyNodeId[];
    gridStep?: number;
    module: CabinetModuleNode;
    nodes: Record<AnyNodeId, AnyNode>;
    parentLevelId: AnyNodeId;
    run: Extract<AnyNode, {
        type: 'cabinet';
    }>;
}): [number, number, number] | null;
export declare function resolveCabinetRunWallSnap({ cabinet, candidatePosition, candidateRotation, excludeIds, gridStep, nodes, parentLevelId, }: {
    cabinet: Extract<AnyNode, {
        type: 'cabinet';
    }>;
    candidatePosition: [number, number, number];
    candidateRotation?: number;
    excludeIds?: readonly AnyNodeId[];
    gridStep?: number;
    nodes: Record<AnyNodeId, AnyNode>;
    parentLevelId: AnyNodeId;
}): CabinetRunWallSnapPose | null;
//# sourceMappingURL=wall-snap.d.ts.map