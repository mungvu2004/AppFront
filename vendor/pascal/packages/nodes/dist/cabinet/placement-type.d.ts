export type CabinetPlacementType = 'cabinet' | 'island';
type CabinetPlacementTypeState = {
    type: CabinetPlacementType;
    setType(type: CabinetPlacementType): void;
    cycleType(): CabinetPlacementType;
};
declare const useCabinetPlacementType: import("zustand").UseBoundStore<import("zustand").StoreApi<CabinetPlacementTypeState>>;
export default useCabinetPlacementType;
//# sourceMappingURL=placement-type.d.ts.map