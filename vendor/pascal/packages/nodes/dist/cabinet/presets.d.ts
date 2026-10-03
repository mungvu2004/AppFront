import type { CabinetModuleNode, CabinetNode } from '@pascal-app/core';
export type CabinetPresetId = 'base-door' | 'drawer-base' | 'dishwasher' | 'cooktop-gas' | 'cooktop-induction' | 'sink-base' | 'tall-pantry' | 'oven-tower' | 'fridge-single';
export type CabinetPreset = {
    id: CabinetPresetId;
    label: string;
    createPatch: (run?: CabinetNode) => Partial<CabinetModuleNode>;
};
export declare const CABINET_PRESETS: CabinetPreset[];
export declare function cabinetPresetById(id: CabinetPresetId): CabinetPreset;
//# sourceMappingURL=presets.d.ts.map