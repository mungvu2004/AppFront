type TemporalLike = {
    temporal: {
        getState(): {
            pastStates: readonly unknown[];
            futureStates: readonly unknown[];
            isTracking: boolean;
        };
    };
};
type SelectionLike = {
    getState(): {
        selection: {
            buildingId: string | null;
            levelId: string | null;
            zoneId: string | null;
            selectedIds: readonly string[];
        };
    };
};
export type PerfHistoryState = {
    /** Undo entries. */
    past: number;
    /** Redo entries. */
    future: number;
    /** False while any owner has history paused. */
    tracking: boolean;
    /** Refcounted pause owners (`pauseSceneHistory` + leases); direct `temporal.pause()` is not counted. */
    pauseDepth: number;
};
export type PerfSelectionState = {
    buildingId: string | null;
    levelId: string | null;
    zoneId: string | null;
    selectedIds: string[];
};
export declare function readPerfHistory(store: TemporalLike): PerfHistoryState;
export declare function readPerfSelection(store: SelectionLike): PerfSelectionState;
export {};
//# sourceMappingURL=perf-probe-state.d.ts.map