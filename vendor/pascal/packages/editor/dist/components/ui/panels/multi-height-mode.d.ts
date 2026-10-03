import { type AnyNode, type AnyNodeId, type ParametricDescriptor } from '@pascal-app/core';
export declare function applyMultiHeightMode(nodeIds: AnyNodeId[], next: 'storey' | 'custom', parametrics: ParametricDescriptor<AnyNode>): void;
export declare function MultiHeightModeField({ nodeIds, nodeType, parametrics, min, max, step, }: {
    nodeIds: AnyNodeId[];
    nodeType: 'wall' | 'ceiling';
    parametrics: ParametricDescriptor<AnyNode>;
    min?: number;
    max?: number;
    step?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=multi-height-mode.d.ts.map