interface SpatialGridConfig {
    cellSize: number;
}
export declare class SpatialGrid {
    private readonly cells;
    private readonly itemCells;
    private readonly itemBounds;
    private readonly config;
    constructor(config: SpatialGridConfig);
    private posToCell;
    private cellKey;
    private getAABB;
    private getItemCells;
    insert(itemId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number]): void;
    remove(itemId: string): void;
    update(itemId: string, position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number]): void;
    canPlace(position: [number, number, number], dimensions: [number, number, number], rotation: [number, number, number], ignoreIds?: string[]): {
        valid: boolean;
        conflictIds: string[];
    };
    queryRadius(x: number, z: number, radius: number): string[];
    getItemCount(): number;
}
export {};
//# sourceMappingURL=spatial-grid.d.ts.map