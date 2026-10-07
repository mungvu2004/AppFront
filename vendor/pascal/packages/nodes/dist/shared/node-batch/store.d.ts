import { type BatchCandidate, type BatchEntry, type GetLevelRoot, type NodeBatchStats, type NodeBatchStoreApi } from './types';
export declare class NodeBatchStore implements NodeBatchStoreApi {
    private readonly getLevelRoot;
    private readonly batches;
    private readonly keysByNode;
    private readonly instancesByNode;
    private readonly pending;
    private instanceCount;
    private readonly counters;
    constructor(getLevelRoot: GetLevelRoot);
    join(candidates: BatchCandidate[], minEntriesForNewBatch: number): BatchEntry[];
    private requiredSpace;
    private addEntry;
    release(nodeId: string): boolean;
    flushReleases(now?: number): void;
    pruneEmpty(now?: number, retainedLevels?: ReadonlySet<string>, earliestDisposalAt?: number): boolean;
    pruneDetached(): Set<string>;
    has(nodeId: string): boolean;
    nodeIds(): ReadonlySet<string>;
    disposeLevel(levelId: string): void;
    disposeAll(): void;
    stats(): NodeBatchStats;
    private createBatch;
    private disposeBatch;
}
//# sourceMappingURL=store.d.ts.map