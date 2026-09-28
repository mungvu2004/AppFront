import type { CabinetModuleNode as CabinetModuleNodeType } from '@pascal-app/core';
export declare function presetWidthDebt(module: CabinetModuleNodeType, sourceId: CabinetModuleNodeType['id']): number;
export declare function metadataWithPresetWidthDebt(module: CabinetModuleNodeType, sourceId: CabinetModuleNodeType['id'], widthDelta: number): CabinetModuleNodeType['metadata'];
export declare function metadataForSelectedWidth(module: CabinetModuleNodeType, width: number, patchMetadata?: CabinetModuleNodeType['metadata']): CabinetModuleNodeType['metadata'];
export declare function presetNominalWidth(module: CabinetModuleNodeType): number;
export declare function recordedPresetNominalWidth(module: CabinetModuleNodeType): number;
//# sourceMappingURL=preset-width-debt.d.ts.map