import type { CabinetModuleNode as CabinetModuleNodeType, CabinetNode as CabinetNodeType } from '@pascal-app/core';
import { type CabinetCompartment } from './stack';
export declare function resolveCompartmentTransition({ node, parentRun, index, next, }: {
    node: CabinetNodeType | CabinetModuleNodeType;
    parentRun: CabinetNodeType | undefined;
    index: number;
    next: CabinetCompartment;
}): {
    stack: CabinetCompartment[];
    modulePatch: Partial<CabinetModuleNodeType>;
};
//# sourceMappingURL=stack-transitions.d.ts.map