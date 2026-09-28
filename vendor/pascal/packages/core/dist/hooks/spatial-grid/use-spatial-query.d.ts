import type { CeilingNode, LevelNode, WallNode } from '../../schema/index.js';
export declare function useSpatialQuery(): {
    canPlaceOnFloor: (levelId: LevelNode["id"], position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], ignoreIds?: string[]) => {
        valid: boolean;
        conflictIds: string[];
    };
    canPlaceOnWall: (levelId: LevelNode["id"], wallId: WallNode["id"], localX: number, localY: number, dimensions: [number, number, number], attachType?: "wall" | "wall-side", side?: "front" | "back", ignoreIds?: string[]) => {
        valid: boolean;
        conflictIds: string[];
        adjustedY: number;
        wasAdjusted: boolean;
    } | {
        valid: boolean;
        conflictIds: never[];
    };
    canPlaceOnCeiling: (ceilingId: CeilingNode["id"], position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], ignoreIds?: string[]) => {
        valid: boolean;
        conflictIds: string[];
    };
};
//# sourceMappingURL=use-spatial-query.d.ts.map