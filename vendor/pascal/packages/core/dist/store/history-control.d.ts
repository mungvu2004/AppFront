import type { Collection, CollectionId } from '../schema/collections.js';
import type { SceneMaterial, SceneMaterialId } from '../schema/scene-material.js';
import type { AnyNode, AnyNodeId } from '../schema/types.js';
export type SceneSnapshot = {
    nodes: Record<AnyNodeId, AnyNode>;
    rootNodeIds: AnyNodeId[];
    collections: Record<CollectionId, Collection>;
    materials: Record<SceneMaterialId, SceneMaterial>;
    installedPlugins: string[];
};
export type SceneCommitOrigin = 'local' | 'load' | 'host';
export type SceneCommit = {
    origin: SceneCommitOrigin;
    before: SceneSnapshot;
    current: SceneSnapshot;
    changedNodeIds?: ReadonlySet<AnyNodeId>;
};
export type SceneCommitListener = (commit: SceneCommit) => void;
type TemporalStoreLike = {
    temporal: {
        getState(): {
            pause(): void;
            resume(): void;
        };
    };
};
type TemporalHistoryStoreLike<TPastState> = {
    temporal: {
        getState(): {
            pastStates: TPastState[];
        };
        setState(state: {
            pastStates: TPastState[];
        }): void;
    };
};
export declare function activeSceneCommitNodeIds(): ReadonlySet<AnyNodeId> | undefined;
export declare function addActiveSceneCommitNodeIds(nodeIds: Iterable<AnyNodeId>): void;
export declare function runWithSceneCommitNodeIds<TResult>(nodeIds: Iterable<AnyNodeId>, run: () => TResult): TResult;
export declare function areSceneSnapshotsEqual(left: SceneSnapshot, right: SceneSnapshot): boolean;
export declare function subscribeSceneCommits(listener: SceneCommitListener): () => void;
export declare function notifySceneCommit(commit: SceneCommit): void;
export declare function pauseSceneHistory(sceneStore: TemporalStoreLike): void;
export declare function resumeSceneHistory(sceneStore: TemporalStoreLike): void;
export declare function acquireSceneHistoryPause(sceneStore: TemporalStoreLike): () => void;
export declare function getSceneHistoryPauseDepth(): number;
export declare function resetSceneHistoryPauseDepth(): void;
export declare function runAsSingleSceneHistoryStep<TPastState, TResult>(sceneStore: TemporalHistoryStoreLike<TPastState>, run: () => TResult): TResult;
export {};
//# sourceMappingURL=history-control.d.ts.map