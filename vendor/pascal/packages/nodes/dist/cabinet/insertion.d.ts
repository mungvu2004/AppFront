import type { AnyNodeId, CabinetModuleNode, CabinetNode, SceneApi } from '@pascal-app/core';
export declare function cabinetModuleForRunInsertion(module: CabinetModuleNode, run: CabinetNode): CabinetModuleNode;
export declare function applyCabinetModuleInsertion({ module, plan, run, sceneApi, }: {
    module: CabinetModuleNode;
    plan: {
        modules: ReadonlyArray<{
            id: AnyNodeId;
            position: [number, number, number];
            width: number;
        }>;
        inserted: {
            position: [number, number, number];
            width: number;
        };
    };
    run: CabinetNode;
    sceneApi: SceneApi;
}): AnyNodeId | null;
//# sourceMappingURL=insertion.d.ts.map