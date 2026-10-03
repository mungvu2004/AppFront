import type { ConstructionDrawingType } from '@pascal-app/core';
export declare const DRAWING_TYPE_OPTIONS: readonly [{
    readonly id: "floor-plan";
    readonly label: "Floor plan";
}, {
    readonly id: "foundation-plan";
    readonly label: "Foundation plan";
}, {
    readonly id: "reflected-ceiling-plan";
    readonly label: "Reflected ceiling plan";
}, {
    readonly id: "roof-plan";
    readonly label: "Roof plan";
}, {
    readonly id: "site-plan";
    readonly label: "Site plan";
}];
export type DrawingAnnotationLayoutOverride = {
    dx: number;
    dy: number;
    pinned: true;
};
export type DrawingAnnotationLayoutOverrides = Record<string, DrawingAnnotationLayoutOverride>;
/**
 * Drawing types the 2D editor can actually render today. `floor-plan` is the
 * default; `site-plan` renders through
 * `lib/floorplan/site-plan/buildSitePlanDrawing`. The remaining
 * `ConstructionDrawingType` members exist on annotations (they gate dimension
 * visibility) but have no editor renderer yet, so the switch does not offer
 * them — widen this union as each one lands.
 */
export type EditorDrawingType = Extract<ConstructionDrawingType, 'floor-plan' | 'site-plan'>;
export declare const EDITOR_DRAWING_TYPE_OPTIONS: readonly [{
    readonly id: "floor-plan";
    readonly label: "Floor plan";
}, {
    readonly id: "site-plan";
    readonly label: "Site plan";
}];
type DrawingViewState = {
    drawingType: EditorDrawingType;
    setDrawingType: (drawingType: EditorDrawingType) => void;
    annotationLayoutOverrides: DrawingAnnotationLayoutOverrides;
    setAnnotationLayoutOverride: (id: string, override: DrawingAnnotationLayoutOverride | null) => void;
};
export declare function normalizeAnnotationLayoutOverrides(value: unknown): DrawingAnnotationLayoutOverrides;
/** Persisted value → a drawing type the editor can render. Unknown → floor-plan. */
export declare function normalizeEditorDrawingType(value: unknown): EditorDrawingType;
declare const useDrawingView: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<DrawingViewState>, "setState" | "persist"> & {
    setState(partial: DrawingViewState | Partial<DrawingViewState> | ((state: DrawingViewState) => DrawingViewState | Partial<DrawingViewState>), replace?: false | undefined): unknown;
    setState(state: DrawingViewState | ((state: DrawingViewState) => DrawingViewState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<DrawingViewState, {
            drawingType: EditorDrawingType;
            annotationLayoutOverrides: DrawingAnnotationLayoutOverrides;
        }, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: DrawingViewState) => void) => () => void;
        onFinishHydration: (fn: (state: DrawingViewState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<DrawingViewState, {
            drawingType: EditorDrawingType;
            annotationLayoutOverrides: DrawingAnnotationLayoutOverrides;
        }, unknown>>;
    };
}>;
export default useDrawingView;
//# sourceMappingURL=use-drawing-view.d.ts.map