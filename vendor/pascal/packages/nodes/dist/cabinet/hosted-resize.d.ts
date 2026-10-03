import type { AnyNode, AnyNodeId, HandleDescriptor, SceneApi } from '@pascal-app/core';
export declare function cabinetHostedChildUpdates(before: Record<AnyNodeId, AnyNode>, after: Record<AnyNodeId, AnyNode>): import("../shared/hosted-resize").HostedUpdate[] | null;
export declare function planCabinetHostedEdit(scene: SceneApi, apply: (staged: SceneApi) => void): import("../shared/hosted-resize").HostedUpdate[] | null;
export declare function withCabinetHostedChildren<N extends AnyNode>(descriptor: HandleDescriptor<N>): HandleDescriptor<N>;
//# sourceMappingURL=hosted-resize.d.ts.map