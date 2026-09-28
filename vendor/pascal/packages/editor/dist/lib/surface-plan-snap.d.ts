import { type AlignmentAnchor, type AlignmentGuide, type AnyNode, type WallNode } from '@pascal-app/core';
import { type WallDraftSnapKind, type WallPlanPoint, type WallSnapRadii } from '../components/tools/wall/wall-drafting';
export declare const SURFACE_ALIGNMENT_THRESHOLD_M = 0.08;
export type SurfacePlanSnapInput = {
    rawPoint: WallPlanPoint;
    fallbackPoint?: WallPlanPoint;
    levelId?: string | null;
    excludeId?: string | null;
    movingId?: string;
    nodes?: Readonly<Record<string, AnyNode>>;
    walls?: readonly WallNode[];
    candidates?: readonly AlignmentAnchor[];
    threshold?: number;
    magnetic?: boolean;
    align?: boolean;
    highlightWalls?: boolean;
    step?: number;
    snapRadii?: WallSnapRadii;
};
export type SurfacePlanSnapResult = {
    point: WallPlanPoint;
    wallSnap: WallDraftSnapKind | null;
    guides: AlignmentGuide[];
    wallIds: string[];
};
export declare function getLevelWalls(nodes: Readonly<Record<string, AnyNode>>, levelId: string | null | undefined, walls?: readonly WallNode[]): WallNode[];
export declare function clearSurfacePlanSnapFeedback(): void;
export declare function resolveSurfacePlanPointSnap(input: SurfacePlanSnapInput): SurfacePlanSnapResult;
//# sourceMappingURL=surface-plan-snap.d.ts.map