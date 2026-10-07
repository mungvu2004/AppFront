export type ElevationGuide3D = {
    ownerId: string;
    levelId: string;
    center: readonly [number, number];
    direction: readonly [number, number];
    elevation: number;
    label: string;
};
type ElevationGuidesState = {
    guide: ElevationGuide3D | null;
    publish(guide: ElevationGuide3D): void;
    clear(ownerId: string): void;
};
declare const useElevationGuides: import("zustand").UseBoundStore<import("zustand").StoreApi<ElevationGuidesState>>;
export default useElevationGuides;
//# sourceMappingURL=use-elevation-guides.d.ts.map