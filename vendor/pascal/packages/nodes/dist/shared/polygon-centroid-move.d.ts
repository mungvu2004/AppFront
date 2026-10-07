import { type AnyNode, type AnyNodeId, type FloorplanMoveTargetSession } from '@pascal-app/core';
export declare function createPolygonCentroidMoveTarget(args: {
    node: {
        id: string;
        type: string;
        polygon: Array<[number, number]>;
        holes?: Array<Array<[number, number]>>;
        metadata?: unknown;
    };
    nodes: Record<AnyNodeId, AnyNode>;
    /** 3D mesh Y the kind's system parks the group at on rebuild. */
    meshY: number;
    /**
     * Extra fields merged into the commit payload. Use for kind-specific flags
     * that a manual drag should clear — e.g. slab `autoFromWalls: false`, so the
     * space-detection sync stops re-deriving the polygon from walls and
     * snapping the slab back to its original position.
     */
    extraCommitData?: Record<string, unknown>;
}): FloorplanMoveTargetSession;
//# sourceMappingURL=polygon-centroid-move.d.ts.map