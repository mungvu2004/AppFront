import type { LeanToExtensionNode, WallNode } from '@pascal-app/core';
export type LeanToPlanPoint = readonly [number, number];
export type LeanToPlanFacet = readonly [
    LeanToPlanPoint,
    LeanToPlanPoint,
    LeanToPlanPoint,
    LeanToPlanPoint
];
export declare function leanToPlanFootprintFacets(node: LeanToExtensionNode, wall: WallNode): LeanToPlanFacet[];
//# sourceMappingURL=plan-footprint.d.ts.map