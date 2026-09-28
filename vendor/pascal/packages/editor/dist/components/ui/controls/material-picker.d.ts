import { type MaterialTarget } from '@pascal-app/core';
export type { MaterialSourceFilter } from '../../../lib/material-catalog-model';
export type MaterialPickerProps = {
    selectedMaterialPreset?: string;
    onSelectMaterialPreset?: (materialPreset: string) => void;
    disabled?: boolean;
    nodeType?: MaterialTarget;
    hideSideControl?: boolean;
    onCreateMaterialRequest?: () => void;
};
/**
 * Catalog material picker: a fixed row of category tabs and a source filter row
 * over a scrollable grid of swatches. Scene-material creation lives in the
 * scene-material section (the host's `+` action); `onCreateMaterialRequest` is
 * the host's entry point for authoring a new *library* material.
 */
export declare function MaterialPicker({ selectedMaterialPreset, onSelectMaterialPreset, disabled, onCreateMaterialRequest, }: MaterialPickerProps): import("react").JSX.Element;
//# sourceMappingURL=material-picker.d.ts.map