import type { WallPlanPoint } from '../components/tools/wall/wall-snap-geometry';
type SegmentKind = 'wall' | 'fence';
type SegmentDraftChainState = {
    wall: WallPlanPoint | null;
    fence: WallPlanPoint | null;
    setChainStart(kind: SegmentKind, point: WallPlanPoint | null): void;
    clear(kind: SegmentKind): void;
};
declare const useSegmentDraftChain: import("zustand").UseBoundStore<import("zustand").StoreApi<SegmentDraftChainState>>;
export default useSegmentDraftChain;
//# sourceMappingURL=use-segment-draft-chain.d.ts.map