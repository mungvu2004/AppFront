import type { TemporalState } from 'zundo';
import { type StoreApi, type UseBoundStore } from 'zustand';
import type { Collection, CollectionId } from '../schema/collections.js';
import { SceneMaterial, type SceneMaterialId } from '../schema/scene-material.js';
import { type AnyNode, type AnyNodeId } from '../schema/types.js';
import { type SceneCommitOrigin, type SceneSnapshot } from './history-control.js';
export type SceneState = {
    nodes: Record<AnyNodeId, AnyNode>;
    rootNodeIds: AnyNodeId[];
    dirtyNodes: Set<AnyNodeId>;
    hydrationToken: object | null;
    hydrationId: object | null;
    invalidateHydration: () => void;
    collections: Record<CollectionId, Collection>;
    materials: Record<SceneMaterialId, SceneMaterial>;
    installedPlugins: string[];
    hasExplicitPluginInstallState: boolean;
    readOnly: boolean;
    setReadOnly: (readOnly: boolean) => void;
    loadScene: () => void;
    clearScene: () => void;
    unloadScene: () => void;
    setScene: (nodes: Record<AnyNodeId, AnyNode>, rootNodeIds: AnyNodeId[], extra?: {
        collections?: Record<CollectionId, Collection>;
        materials?: Record<SceneMaterialId, SceneMaterial>;
        installedPlugins?: string[];
        hasExplicitPluginInstallState?: boolean;
    }) => void;
    setInstalledPlugins: (pluginIds: string[], options?: {
        explicit?: boolean;
    }) => void;
    markDirty: (id: AnyNodeId) => void;
    clearDirty: (id: AnyNodeId) => void;
    createNode: (node: AnyNode, parentId?: AnyNodeId) => void;
    createNodes: (ops: {
        node: AnyNode;
        parentId?: AnyNodeId;
    }[]) => void;
    applyNodeChanges: (changes: {
        create?: {
            node: AnyNode;
            parentId?: AnyNodeId;
        }[];
        update?: {
            id: AnyNodeId;
            data: Partial<AnyNode>;
        }[];
        delete?: AnyNodeId[];
    }) => void;
    updateNode: (id: AnyNodeId, data: Partial<AnyNode>) => void;
    updateNodes: (updates: {
        id: AnyNodeId;
        data: Partial<AnyNode>;
    }[]) => void;
    deleteNode: (id: AnyNodeId) => void;
    deleteNodes: (ids: AnyNodeId[]) => void;
    createCollection: (name: string, nodeIds?: AnyNodeId[]) => CollectionId;
    deleteCollection: (id: CollectionId) => void;
    updateCollection: (id: CollectionId, data: Partial<Omit<Collection, 'id'>>) => void;
    addToCollection: (id: CollectionId, nodeId: AnyNodeId) => void;
    removeFromCollection: (id: CollectionId, nodeId: AnyNodeId) => void;
    addSceneMaterial: (material: SceneMaterial) => void;
    updateSceneMaterial: (id: SceneMaterialId, data: Partial<Omit<SceneMaterial, 'id'>>) => void;
    removeSceneMaterial: (id: SceneMaterialId) => void;
};
type UseSceneStore = UseBoundStore<StoreApi<SceneState>> & {
    temporal: StoreApi<TemporalState<Pick<SceneState, 'nodes' | 'rootNodeIds' | 'collections' | 'materials' | 'installedPlugins'>>>;
};
declare const useScene: UseSceneStore;
export default useScene;
export declare function acquireSceneReadOnlyLease(): () => void;
export type SceneNodePatch = {
    id: AnyNodeId;
    data: Partial<AnyNode>;
    removeFields: string[];
};
export type SceneMaterialPatch = {
    id: SceneMaterialId;
    material: SceneMaterial | null;
};
export type ScenePatch = {
    materialChanges: SceneMaterialPatch[];
    nodeUpdates: SceneNodePatch[];
};
export type SceneNodeStructuralPatch = {
    node: AnyNode;
    position: number;
};
export type SceneOperationPatch = ScenePatch & {
    nodeCreates: SceneNodeStructuralPatch[];
    nodeDeletes: SceneNodeStructuralPatch[];
};
export declare function applySceneOperationPatch(changes: SceneOperationPatch): boolean;
export declare function applyScenePatch(changes: ScenePatch): boolean;
export type ApplySceneSnapshotOptions = {
    origin: Extract<SceneCommitOrigin, 'load' | 'host'>;
};
export declare function applySceneSnapshot(snapshot: SceneSnapshot, options: ApplySceneSnapshotOptions): boolean;
export declare function clearSceneHistory(): void;
//# sourceMappingURL=use-scene.d.ts.map