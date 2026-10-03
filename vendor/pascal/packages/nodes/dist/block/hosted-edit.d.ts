import { type AnyNodeId, type BlockTopology, type SceneApi } from '@pascal-app/core';
import { type HostedUpdate } from '../shared/hosted-resize';
export declare const BLOCK_SUPPORT_REFUSAL = "This edit would remove support for an item on the block";
type EditScene = Pick<SceneApi, 'get' | 'update' | 'applyChanges'>;
export declare function planBlockTopologyEdit(scene: Pick<SceneApi, 'get'>, id: AnyNodeId, topology: BlockTopology): HostedUpdate[] | null;
export declare function commitBlockTopologyEdit(scene: EditScene, id: AnyNodeId, topology: BlockTopology): boolean;
export declare function createBlockTopologyPreview(id: AnyNodeId, scene: Pick<SceneApi, 'get' | 'markDirty'>): {
    clear: () => void;
    readonly valid: boolean;
    set(topology: BlockTopology): boolean;
};
export {};
//# sourceMappingURL=hosted-edit.d.ts.map