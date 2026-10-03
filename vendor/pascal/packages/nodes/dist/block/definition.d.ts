import { type BlockNode as BlockNodeType, type NodeDefinition } from '@pascal-app/core';
import { BlockNode } from './schema';
export declare function blockBounds(node: BlockNodeType): {
    size: [number, number, number];
    center: [number, number, number];
};
export declare const blockDefinition: NodeDefinition<typeof BlockNode>;
//# sourceMappingURL=definition.d.ts.map