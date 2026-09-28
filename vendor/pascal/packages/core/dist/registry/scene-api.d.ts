import type { AnyNode, AnyNodeId } from '../schema/types.js';
import type { SceneApi } from './types.js';
/**
 * Minimal store shape this module depends on.
 *
 * Decoupled from `useScene` directly so the production singleton and tests can
 * share one factory. The full store implements a superset.
 */
export type SceneStoreLike = {
    getState: () => {
        nodes: Record<AnyNodeId, AnyNode>;
        rootNodeIds: AnyNodeId[];
        dirtyNodes: Set<AnyNodeId>;
        createNode: (node: AnyNode, parentId?: AnyNodeId) => void;
        createNodes?: (ops: {
            node: AnyNode;
            parentId?: AnyNodeId;
        }[]) => void;
        applyNodeChanges?: (changes: {
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
        deleteNode: (id: AnyNodeId) => void;
        markDirty: (id: AnyNodeId) => void;
    };
    subscribe?: (listener: (state: {
        nodes: Record<AnyNodeId, AnyNode>;
    }, previous: {
        nodes: Record<AnyNodeId, AnyNode>;
    }) => void) => () => void;
    temporal: {
        getState: () => {
            pause: () => void;
            resume: () => void;
        };
    };
};
/**
 * The kernel host seam (frozen by A-02; `ai-surface-agnostic-scene-tools.md`
 * Phase 0.2). The object every surface — chat, public and hosted MCP, REST,
 * CLI, bench — hands the one tool kernel. It wraps this module's store seam
 * instead of adding a second one; the program library's `Host` and MCP's
 * `SceneOperations` become implementations. Optional capabilities (catalog,
 * sampling, persistence receipts) join additively, and a missing one is a
 * typed refusal, never an implicit cloud fallback. Nothing implements it yet.
 */
export type SceneToolHost = {
    store: SceneStoreLike;
    getActiveLevelId: () => AnyNodeId | null;
    /** A host without a selection answers an empty list. */
    getSelection?: () => readonly AnyNodeId[];
    /**
     * Runs `fn` as one logical transaction: validated against the proposed
     * final graph, committed once and undone as one step (R2, R8).
     */
    transact?: <T>(label: string, fn: (scene: SceneApi) => T) => T;
};
/**
 * Creates a {@link SceneApi} backed by a store.
 *
 * Snapshot semantics:
 * - `pauseHistory()` starts a copy-on-write window. The first time `update`,
 *   `upsert`, or `delete` touches a node id, the pre-change value is captured.
 * - `restore(id)` and `restoreAll()` apply the captured value back. Either is
 *   safe to call only while a pause window is active.
 * - `resumeHistory()` drops the snapshot.
 *
 * Snapshots are lazy and bounded by the number of nodes touched during the
 * pause window — never an upfront clone of the entire scene.
 */
export declare function createSceneApi(store: SceneStoreLike): SceneApi;
//# sourceMappingURL=scene-api.d.ts.map