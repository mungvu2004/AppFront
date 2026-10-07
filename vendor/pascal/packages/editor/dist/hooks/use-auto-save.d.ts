import { type SceneGraph } from '../lib/scene';
export declare function isSuspiciousNodeDrop(previousNodeCount: number, currentNodeCount: number): boolean;
/**
 * Tracks the node count of the graph we believe is stored, which is what the
 * accidental-wipe guard measures every write against.
 *
 * The distinction that matters: a graph that came from storage is authoritative
 * and has to become the new baseline, while an edited or previewed graph must
 * not. Seeding the baseline once at mount is not enough — the hook mounts
 * before the scene has loaded, so it would sit at ~0 for the whole session and
 * `isSuspiciousNodeDrop` could never fire.
 */
export declare function createStoredNodeCountTracker(initialNodeCount: number): {
    readonly count: number;
    /** A graph read from storage — it defines what "populated" means from here. */
    trackLoadedGraph(nodeCount: number): void;
    /**
     * `false` when the write would drop a populated scene to a bare scaffold,
     * which is an accidental full deletion far more often than an intent. The
     * caller reports the block; on `true` the write becomes the new baseline.
     */
    allowWrite(nodeCount: number, guardAgainstSceneWipe?: boolean): boolean;
};
export type ExitFlushDecision = 'skip-clean' | 'skip-loading' | 'blocked-suspicious' | 'flush';
/**
 * Decides what the unload/unmount flush may do with the store's current
 * content. Pure so the wipe scenarios stay unit-testable.
 *
 * `skip-loading` is the load-bearing branch: while a scene load is in flight
 * the store passes through an intermediate `unloadScene()` state — zero nodes,
 * zero roots — that is NOT user data. A flush fired in that window (StrictMode
 * simulated unmount in dev, a quick tab close or navigation in prod) used to
 * serialize that empty store and PUT it over the server copy, wiping the scene
 * at v2. The dirty flag alone cannot protect here: document-level writes that
 * land before hydration (e.g. the host-panel default `installedPlugins` sync)
 * mark the session dirty without any user edit.
 */
export declare function decideExitFlush(opts: {
    isLoadingScene: boolean;
    hasDirtyChanges: boolean;
    storedNodeCount: number;
    currentNodeCount: number;
    guardAgainstSceneWipe?: boolean;
}): ExitFlushDecision;
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'paused' | 'error';
interface UseAutoSaveOptions {
    guardAgainstSceneWipe?: boolean;
    onSave?: (scene: SceneGraph, options?: {
        keepalive?: boolean;
    }) => Promise<void>;
    onDirty?: () => void;
    onSaveStatusChange?: (status: SaveStatus) => void;
    isVersionPreviewMode?: boolean;
}
/**
 * Generic autosave hook. Subscribes to the scene store and debounces saves.
 * Falls back to localStorage when no `onSave` is provided.
 *
 * ⚠️  Mount in exactly ONE component (the Editor).
 */
export declare function useAutoSave({ guardAgainstSceneWipe, onSave, onDirty, onSaveStatusChange, isVersionPreviewMode, }: UseAutoSaveOptions): {
    beginSceneLoad: () => void;
    completeSceneLoad: () => void;
    saveNow: () => void;
};
export {};
//# sourceMappingURL=use-auto-save.d.ts.map