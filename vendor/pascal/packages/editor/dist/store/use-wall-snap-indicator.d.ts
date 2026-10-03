/** Which kind of wall geometry the draft point snapped to. */
export type WallSnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'wall';
export type WallSnapPoint = {
    /** Building-local plan coordinates (XZ meters). */
    x: number;
    z: number;
    kind: WallSnapKind;
    /** Optional wall ids whose geometry produced this snap. */
    wallIds?: string[];
};
type WallSnapIndicatorState = {
    point: WallSnapPoint | null;
    set(point: WallSnapPoint | null): void;
    clear(): void;
};
declare const useWallSnapIndicator: import("zustand").UseBoundStore<import("zustand").StoreApi<WallSnapIndicatorState>>;
export default useWallSnapIndicator;
//# sourceMappingURL=use-wall-snap-indicator.d.ts.map