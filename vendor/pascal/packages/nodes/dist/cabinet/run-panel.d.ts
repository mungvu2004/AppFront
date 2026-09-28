import type { CabinetModuleNode as CabinetModuleNodeType, CabinetNode as CabinetNodeType } from '@pascal-app/core';
import { useScene } from '@pascal-app/core';
export type CabinetEditableNode = CabinetNodeType | CabinetModuleNodeType;
export declare function bumpRunLayoutRevisionViaStore(scene: ReturnType<typeof useScene.getState>, run: CabinetNodeType): void;
export declare function reflowRunModules({ modules, parentRun, patch, scene, selected, }: {
    modules: CabinetModuleNodeType[];
    parentRun: CabinetNodeType;
    patch: Partial<CabinetModuleNodeType>;
    scene: ReturnType<typeof useScene.getState>;
    selected: CabinetModuleNodeType;
}): boolean;
export declare function updateCabinetRun(args: {
    modules: CabinetModuleNodeType[];
    node: CabinetNodeType;
    patch: Partial<CabinetNodeType>;
}): void;
export declare function CabinetRunPanel({ node, modules, onClose, }: {
    node: CabinetNodeType;
    modules: CabinetModuleNodeType[];
    onClose: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=run-panel.d.ts.map