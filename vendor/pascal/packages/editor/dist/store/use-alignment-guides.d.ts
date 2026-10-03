import type { AlignmentGuide } from '@pascal-app/core';
type AlignmentGuidesState = {
    guides: AlignmentGuide[];
    set(guides: AlignmentGuide[]): void;
    clear(): void;
};
declare const useAlignmentGuides: import("zustand").UseBoundStore<import("zustand").StoreApi<AlignmentGuidesState>>;
export default useAlignmentGuides;
//# sourceMappingURL=use-alignment-guides.d.ts.map