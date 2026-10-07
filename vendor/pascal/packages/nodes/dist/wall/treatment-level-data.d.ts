import { type WallMiterData, type WallNode } from '@pascal-app/core';
export declare function treatmentProudKeys(proudOffsets: readonly number[]): number[];
export declare function sameTreatmentWalls(a: readonly WallNode[], b: readonly WallNode[]): boolean;
export type WallTreatmentLevelData = {
    walls: readonly WallNode[];
    miterDataByProud: ReadonlyMap<number, WallMiterData>;
};
export declare function clearWallTreatmentMiterCache(levelId?: string): void;
export declare function buildWallTreatmentLevelData(levelId: string, walls: readonly WallNode[], proudOffsets: readonly number[]): WallTreatmentLevelData;
export declare function treatmentMiterDataForProud(levelData: WallTreatmentLevelData, proud: number): WallMiterData | undefined;
type WallTreatmentLevelDataState = {
    byLevelId: ReadonlyMap<string, WallTreatmentLevelData>;
    setLevelData: (levelId: string, data: WallTreatmentLevelData) => void;
    removeLevelData: (levelId: string) => void;
};
export declare function createWallTreatmentSelector(node: WallNode, proudOffsets: readonly number[]): (state: WallTreatmentLevelDataState) => WallTreatmentLevelData | undefined;
export declare const useWallTreatmentLevelData: import("zustand").UseBoundStore<import("zustand").StoreApi<WallTreatmentLevelDataState>>;
export {};
//# sourceMappingURL=treatment-level-data.d.ts.map