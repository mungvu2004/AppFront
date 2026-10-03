export type RoofPlacementMode = 'auto' | 'ground' | 'roof';
type RoofPlacementModeState = {
    conical: boolean;
    mode: RoofPlacementMode;
    cycleMode: () => void;
    setConical: (conical: boolean) => void;
};
declare const useRoofPlacementMode: import("zustand").UseBoundStore<import("zustand").StoreApi<RoofPlacementModeState>>;
export declare const conicalRoofToolHintVisibility: {
    subscribe: (onChange: () => void) => () => void;
    value: () => boolean;
};
export declare const standardRoofToolHintVisibility: {
    subscribe: (onChange: () => void) => () => void;
    value: () => boolean;
};
export default useRoofPlacementMode;
//# sourceMappingURL=roof-placement-mode.d.ts.map