export type RoofOverlapEntry = {
    roofId: string;
    segmentId: string;
    supportRoofId?: string;
    supportRoofSegmentId?: string;
    roofType?: string;
    width: number;
    depth: number;
};
export type RoofPlanBounds = {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
};
export type RoofPlanSegment = {
    position: readonly [number, number, number];
    rotation?: number;
    width: number;
    depth: number;
};
export type RoofPlan = {
    position: readonly [number, number, number];
    rotation?: number;
    segments: readonly RoofPlanSegment[];
};
export declare function compareRoofOverlapIdentity(a: RoofOverlapEntry, b: RoofOverlapEntry): number;
export declare function roofOverlapEntryOwns(candidate: RoofOverlapEntry, current: RoofOverlapEntry, epsilon?: number): boolean;
export declare function roofPlanOverlapEntryOwns(candidate: RoofOverlapEntry, current: RoofOverlapEntry, epsilon?: number): boolean;
export declare function getRoofPlanBounds(roof: RoofPlan): RoofPlanBounds | null;
export declare function roofPlanBoundsOverlap(a: RoofPlanBounds, b: RoofPlanBounds, epsilon?: number): boolean;
//# sourceMappingURL=roof-overlap.d.ts.map