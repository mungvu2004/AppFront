import type { AnyNode, AnyNodeId, CabinetModuleNode, CabinetNode } from '@pascal-app/core';
export type CabinetModulePanelContext = {
    parentRun: CabinetNode;
    reflowModule: CabinetModuleNode | null;
};
export declare function cabinetModulePanelContext(module: CabinetModuleNode, nodes: Readonly<Partial<Record<AnyNodeId, AnyNode>>>): CabinetModulePanelContext | null;
//# sourceMappingURL=panel-context.d.ts.map