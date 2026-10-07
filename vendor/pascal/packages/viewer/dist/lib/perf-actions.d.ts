export type PerfActionReceipt = {
    name: string;
    /** Free-form context, e.g. the node id or kind. */
    detail: string;
    /** begin → commit (the human gesture; 0 for instant actions like undo). */
    dragMs: number;
    /** commit → fully settled (rebuilds + one GPU sample after quiet). */
    settleMs: number;
    /** begin → settled. */
    totalMs: number;
    /** Frames observed between commit and settled. */
    settleFrames: number;
    /** Per-track attribution over begin → settled, sorted by totalMs desc. */
    tracks: Array<{
        name: string;
        totalMs: number;
        count: number;
    }>;
    outcome: 'settled' | 'interrupted' | 'timeout';
    endedAt: number;
};
/**
 * Start attributing samples to a named action. Interrupts any active one.
 * Returns an id the caller can compare against `getActivePerfActionId()` to
 * commit only the action it actually began.
 */
export declare function beginPerfAction(name: string, detail?: string): number | null;
/** The gesture ended (pointer up / operation dispatched); settling begins. */
export declare function commitPerfAction(): void;
/** The gesture was aborted (Escape mid-drag); discard without a settle wait. */
export declare function cancelPerfAction(): void;
/** Convenience for instant actions (undo, level switch): begin + commit. */
export declare function markPerfAction(name: string, detail?: string): void;
/**
 * Whether an action is currently being attributed. Lets a generic call site
 * (the interaction scope) yield to a more specific one that began first.
 */
export declare function hasActivePerfAction(): boolean;
/**
 * Like `hasActivePerfAction`, but false once the active action has committed.
 * A generic bracket yields to an UNCOMMITTED action (a gesture in flight) but
 * must be free to start a new receipt while the previous one is merely
 * settling — beginPerfAction then finalizes the settling one as interrupted.
 */
export declare function hasUncommittedPerfAction(): boolean;
/** Id of the action currently attributing samples, if any. */
export declare function getActivePerfActionId(): number | null;
/**
 * Called once per frame by the viewer settle system with the current dirty
 * count and the wall system's deferred-neighbour backlog. Also the ledger's
 * only heartbeat, so it is where a stuck action gets released.
 */
export declare function notifyPerfActionFrame(dirtyCount: number, pendingRebuilds: number): void;
export declare function usePerfActionReceipts(): PerfActionReceipt[];
//# sourceMappingURL=perf-actions.d.ts.map