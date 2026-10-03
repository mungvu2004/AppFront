import { type FloorplanMode } from '../lib/floorplan/floorplan-mode';
export type FloorplanModeNotice = {
    id: number;
    kind: 'info' | 'switch-to-expert';
    message: string;
};
type FloorplanModeState = {
    mode: FloorplanMode;
    projectId: string | null;
    modesByProject: Record<string, FloorplanMode>;
    hasShownDefaultReassurance: boolean;
    notice: FloorplanModeNotice | null;
    dismissNotice: () => void;
    setMode: (mode: FloorplanMode) => void;
    setProjectId: (projectId: string | null) => void;
    showExpertModeNotice: (toolLabel: string) => void;
    showNotice: (message: string) => void;
};
declare const useFloorplanMode: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<FloorplanModeState>, "setState" | "persist"> & {
    setState(partial: FloorplanModeState | Partial<FloorplanModeState> | ((state: FloorplanModeState) => FloorplanModeState | Partial<FloorplanModeState>), replace?: false | undefined): unknown;
    setState(state: FloorplanModeState | ((state: FloorplanModeState) => FloorplanModeState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<FloorplanModeState, {
            hasShownDefaultReassurance: boolean;
            modesByProject: Record<string, "default" | "expert">;
        }, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: FloorplanModeState) => void) => () => void;
        onFinishHydration: (fn: (state: FloorplanModeState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<FloorplanModeState, {
            hasShownDefaultReassurance: boolean;
            modesByProject: Record<string, "default" | "expert">;
        }, unknown>>;
    };
}>;
export default useFloorplanMode;
//# sourceMappingURL=use-floorplan-mode.d.ts.map