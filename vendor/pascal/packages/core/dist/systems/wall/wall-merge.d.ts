import { type AnyNode, type AnyNodeId, type WallNode } from '../../schema/index.js';
import type { WallTopologyChanges } from './wall-topology.js';
export type WallAttachmentUpdate = {
    id: AnyNodeId;
    data: Partial<AnyNode>;
};
export declare function getWallEndpointAtPoint(wall: Pick<WallNode, 'start' | 'end'>, point: [number, number]): 'start' | 'end' | null;
/**
 * The first thing two walls disagree on (for the merge's explanation), or null.
 * The delete heal is strict: room sides must match, and a wall following the
 * storey never joins one with an explicit height. An explicit merge compares
 * what is visible instead — `heightOf` resolves each wall's actual height — and
 * leaves the sides to room detection, which reclassifies the merged wall.
 */
export declare function wallStyleMismatch(a: WallNode, b: WallNode, options: {
    sides: boolean;
    heightOf?: (wall: WallNode) => number;
}): string | null;
export declare function areWallStylesCompatible(a: WallNode, b: WallNode): boolean;
export declare function areWallsCollinearAcrossPoint(a: WallNode, b: WallNode, sharedPoint: [number, number]): boolean;
export declare function resolveMergedWallEndpoints(primary: WallNode, secondary: WallNode, sharedPoint: [number, number]): {
    start: [number, number];
    end: [number, number];
};
export declare function buildMergedWallAttachmentUpdates(primary: WallNode, secondary: WallNode, mergedWallId: AnyNodeId, mergedStart: [number, number], mergedEnd: [number, number], nodes: Record<AnyNodeId, AnyNode>): WallAttachmentUpdate[];
/**
 * Merges a straight run of adjoining walls into one — the inverse of a split.
 * Every joint must hold exactly these walls (a T or a cross stays split), and
 * neighbours must continue in line and look alike (`wallStyleMismatch`: same
 * thickness, visible height and finish). The wall with the most attachments
 * keeps its id and height mode; openings and wall items keep their world
 * position on it.
 */
export declare function planWallMerge(nodes: Record<AnyNodeId, AnyNode>, wallIds: readonly AnyNodeId[]): {
    changes: WallTopologyChanges;
    wallId: WallNode['id'];
};
//# sourceMappingURL=wall-merge.d.ts.map