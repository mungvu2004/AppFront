import { type RoofSegmentNode } from '@pascal-app/core';
export type DormerSegmentTransform = {
    position: [number, number, number];
    quaternion: [number, number, number, number];
};
export type DormerPlacementHit = {
    segment: RoofSegmentNode;
    localX: number;
    localY: number;
    localZ: number;
};
/**
 * Shared placement-tool plumbing for fresh-place and duplicate/move
 * tools. Owns:
 *   - cursor → roof-segment hit resolution (delegated to the host
 *     RoofNode pointer events)
 *   - building-local segment transform extraction (for ghost mounting)
 *   - 5cm grid snap + SFX cue
 *   - keyboard rotate (R / Shift+R, ±15°)
 *
 * Does NOT own:
 *   - the ghost mesh (caller renders `<DormerPreview>`)
 *   - any node-lifecycle state (caller passes an `onCommit` that
 *     decides between createNode / updateNode / etc.)
 *
 * Returns the segment transform + cursor hit so the caller can mount
 * the ghost, plus the live ghost rotation (driven by R / Shift+R).
 */
export declare function useDormerPlacement(opts: {
    initialRotation?: number;
    relativeStart?: {
        position: [number, number, number];
        roofSegmentId?: string;
    };
    onCommit: (hit: DormerPlacementHit, rotation: number) => void;
}): {
    activeBuildingId: string | undefined;
    clearPreview: () => void;
    segmentXform: DormerSegmentTransform | null;
    hitSegment: RoofSegmentNode | null;
    hitLocal: [number, number, number] | null;
    ghostRotation: number;
};
//# sourceMappingURL=use-dormer-placement.d.ts.map