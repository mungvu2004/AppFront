import { type FloorplanAnnotationCategory, type FloorplanAnnotationVisibility } from '../lib/floorplan/annotation-visibility';
import { type FloorplanWallDimensionReference } from '../lib/floorplan/floorplan-extension';
type FloorplanAnnotationVisibilityState = {
    visibility: FloorplanAnnotationVisibility;
    wallDimensionReference: FloorplanWallDimensionReference;
    setCategory: (category: FloorplanAnnotationCategory, visible: boolean) => void;
    setWallDimensionReference: (reference: FloorplanWallDimensionReference) => void;
    reset: () => void;
};
declare const useFloorplanAnnotationVisibility: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<FloorplanAnnotationVisibilityState>, "setState" | "persist"> & {
    setState(partial: FloorplanAnnotationVisibilityState | Partial<FloorplanAnnotationVisibilityState> | ((state: FloorplanAnnotationVisibilityState) => FloorplanAnnotationVisibilityState | Partial<FloorplanAnnotationVisibilityState>), replace?: false | undefined): unknown;
    setState(state: FloorplanAnnotationVisibilityState | ((state: FloorplanAnnotationVisibilityState) => FloorplanAnnotationVisibilityState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<FloorplanAnnotationVisibilityState, FloorplanAnnotationVisibilityState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: FloorplanAnnotationVisibilityState) => void) => () => void;
        onFinishHydration: (fn: (state: FloorplanAnnotationVisibilityState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<FloorplanAnnotationVisibilityState, FloorplanAnnotationVisibilityState, unknown>>;
    };
}>;
export default useFloorplanAnnotationVisibility;
//# sourceMappingURL=use-floorplan-annotation-visibility.d.ts.map