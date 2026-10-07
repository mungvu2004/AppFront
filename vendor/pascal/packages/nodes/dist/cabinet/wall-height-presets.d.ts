import type { CabinetNode } from '@pascal-app/core';
export type CabinetWallHeightPresetId = '18' | '24' | '30' | '36' | '42';
export type CabinetWallHeightPreset = {
    id: CabinetWallHeightPresetId;
    label: string;
    metricLabel: string;
    value: number;
};
export declare const CABINET_WALL_HEIGHT_PRESETS: CabinetWallHeightPreset[];
export declare function cabinetWallHeightPresetId(node: Pick<CabinetNode, 'carcassHeight'> | number): CabinetWallHeightPresetId | 'custom';
export declare function cabinetWallHeightPresetById(id: CabinetWallHeightPresetId): CabinetWallHeightPreset;
//# sourceMappingURL=wall-height-presets.d.ts.map