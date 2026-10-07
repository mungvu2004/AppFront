import { type AnyNode, type AnyNodeId, type HandleDescriptor, type SceneApi } from '@pascal-app/core';
export type HostedEditPolicy = {
    host: (node: AnyNode) => boolean;
    child: (node: AnyNode) => boolean;
};
type Nodes = Record<AnyNodeId, AnyNode>;
export type HostedUpdate = readonly [AnyNodeId, Partial<AnyNode>];
export declare function hostedChildUpdates(before: Nodes, after: Nodes, policy: HostedEditPolicy): HostedUpdate[] | null;
export declare function planHostedEdit(sceneApi: SceneApi, apply: (staged: SceneApi) => void, policy: HostedEditPolicy): HostedUpdate[] | null;
export declare function withHostedChildren<N extends AnyNode>(descriptor: HandleDescriptor<N>, policy: HostedEditPolicy): HandleDescriptor<N>;
export {};
//# sourceMappingURL=hosted-resize.d.ts.map