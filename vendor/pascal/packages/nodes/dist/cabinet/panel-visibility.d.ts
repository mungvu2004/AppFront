import type { CabinetModuleNode, CabinetNode } from '@pascal-app/core';
export declare function cabinetModuleSupportsPresets(module: CabinetModuleNode): boolean;
export declare function cabinetModuleUsesFixedApplianceWidth(module: CabinetModuleNode): boolean;
export declare function cabinetModuleSupportsTopFinish({ module, parentIsModule, parentRun, }: {
    module: CabinetModuleNode;
    parentIsModule: boolean;
    parentRun?: CabinetNode;
}): boolean;
//# sourceMappingURL=panel-visibility.d.ts.map