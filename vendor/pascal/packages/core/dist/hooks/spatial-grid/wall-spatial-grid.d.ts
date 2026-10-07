type WallSide = 'front' | 'back';
type AttachType = 'wall' | 'wall-side';
interface WallItemPlacement {
    itemId: string;
    wallId: string;
    tStart: number;
    tEnd: number;
    yStart: number;
    yEnd: number;
    attachType?: AttachType;
    side?: WallSide;
}
export declare class WallSpatialGrid {
    private readonly wallItems;
    private readonly itemToWall;
    /**
     * Check if an item can be placed on a wall with auto-adjustment for vertical position
     * @param wallId - The wall to place on
     * @param wallLength - Length of the wall
     * @param wallHeight - Height of the wall
     * @param tCenter - Parametric center position (0-1) along wall
     * @param itemWidth - Width of the item
     * @param yBottom - Bottom Y position of the item
     * @param itemHeight - Height of the item
     * @param attachType - 'wall' (blocks both sides) or 'wall-side' (blocks one side)
     * @param side - Which side for 'wall-side' items
     * @param ignoreIds - Item IDs to ignore in conflict check
     * @returns Validation result with auto-adjusted Y position if needed
     */
    canPlaceOnWall(wallId: string, wallLength: number, wallHeight: number, tCenter: number, itemWidth: number, yBottom: number, itemHeight: number, attachType?: AttachType, side?: WallSide, ignoreIds?: string[]): {
        valid: boolean;
        conflictIds: string[];
        adjustedY: number;
        wasAdjusted: boolean;
    };
    /**
     * Check if two items conflict based on their attach types and sides
     * - 'wall' items block both sides, so they conflict with everything
     * - 'wall-side' items only conflict if they're on the same side or if the other is a 'wall' item
     */
    private checkSideConflict;
    insert(placement: WallItemPlacement): void;
    remove(wallId: string, itemId: string): void;
    removeByItemId(itemId: string): void;
    removeWall(wallId: string): string[];
    getWallForItem(itemId: string): string | undefined;
    clear(): void;
}
export {};
//# sourceMappingURL=wall-spatial-grid.d.ts.map