export type FenceCurveDraftPoint = [number, number];
type FenceCurveDraftState = {
    pointCount: number;
    points: FenceCurveDraftPoint[];
    cursor: FenceCurveDraftPoint | null;
    setDraft(points: readonly FenceCurveDraftPoint[], cursor: FenceCurveDraftPoint | null): void;
    reset(): void;
};
declare const useFenceCurveDraft: import("zustand").UseBoundStore<import("zustand").StoreApi<FenceCurveDraftState>>;
export default useFenceCurveDraft;
//# sourceMappingURL=use-fence-curve-draft.d.ts.map