export declare function commitHandleDragPatch<T>({ commit, patch, resumeHistory, runAsSingleHistoryStep, }: {
    commit: (patch: T) => void;
    patch: T;
    resumeHistory: () => void;
    runAsSingleHistoryStep: (run: () => void) => void;
}): void;
//# sourceMappingURL=handle-drag-history.d.ts.map