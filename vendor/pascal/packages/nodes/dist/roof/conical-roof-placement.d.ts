import { type AnyNode, type LevelNode, type RoofNode, type RoofSupport } from '@pascal-app/core';
export type ConicalRoofLevelPlacement = {
    valid: true;
    kind: 'level';
    position: [number, number, number];
    wallHeight: number;
    support: Extract<RoofSupport, {
        kind: 'level';
    }>;
};
export type ConicalRoofSurfacePlacement = {
    valid: true;
    kind: 'roof';
    position: [number, number, number];
    wallHeight: number;
    hostRoofId: RoofNode['id'];
    support: Extract<RoofSupport, {
        kind: 'roof';
    }>;
};
export type ConicalRoofInvalidPlacement = {
    valid: false;
    reason: 'no-roof-support';
};
export type ConicalRoofPlacement = ConicalRoofLevelPlacement | ConicalRoofSurfacePlacement | ConicalRoofInvalidPlacement;
export type ResolveConicalRoofPlacementInput = {
    nodes: Readonly<Record<string, AnyNode>>;
    levelId: LevelNode['id'];
    center: readonly [number, number];
    radius: number;
    curbHeight: number;
    allowRoofSupport: boolean;
    requireRoofSupport: boolean;
};
export declare function resolveConicalRoofPlacement({ nodes, levelId, center, radius, curbHeight, allowRoofSupport, requireRoofSupport, }: ResolveConicalRoofPlacementInput): ConicalRoofPlacement;
//# sourceMappingURL=conical-roof-placement.d.ts.map