export type OpeningGuideVec3 = [number, number, number];
export type OpeningGuide3D = {
    kind: 'dimension';
    id: string;
    from: OpeningGuideVec3;
    to: OpeningGuideVec3;
    value: number;
} | {
    kind: 'align-line';
    id: string;
    from: OpeningGuideVec3;
    to: OpeningGuideVec3;
} | {
    kind: 'badge';
    id: string;
    at: OpeningGuideVec3;
    value: number;
};
type OpeningGuidesState = {
    guides: OpeningGuide3D[];
    set(guides: OpeningGuide3D[]): void;
    clear(): void;
};
declare const useOpeningGuides: import("zustand").UseBoundStore<import("zustand").StoreApi<OpeningGuidesState>>;
export default useOpeningGuides;
//# sourceMappingURL=use-opening-guides.d.ts.map