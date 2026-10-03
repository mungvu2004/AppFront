import { type AnyNode, type RendererSource } from '@pascal-app/core';
import { type ComponentType } from 'react';
export declare function getRegistryRenderer(source: RendererSource<AnyNode>): ComponentType<{
    node: AnyNode;
}> | null;
export declare const NodeRenderer: ({ nodeId }: {
    nodeId: AnyNode["id"];
}) => import("react").JSX.Element | null;
//# sourceMappingURL=node-renderer.d.ts.map