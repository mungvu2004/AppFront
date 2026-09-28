import type { WallNode } from '@pascal-app/core';
import type { WallSplitPreview, WallSplitSnap } from './split-preview';
export type WallSplitDraft = {
    wallId: WallNode['id'];
    cuts: number;
    /** The single cut's snapped distance from the wall start; more cuts are evenly spaced. */
    distance: number;
    snap: WallSplitSnap;
    preview: WallSplitPreview;
};
/** The open split's cut preview. Every transition lives in `split-session.ts`. */
export declare const useWallSplit: import("zustand").UseBoundStore<import("zustand").StoreApi<{
    draft: WallSplitDraft | null;
    setDraft: (draft: WallSplitDraft | null) => void;
}>>;
//# sourceMappingURL=split-store.d.ts.map