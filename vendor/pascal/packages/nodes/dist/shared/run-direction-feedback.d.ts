import type { RunPoint } from './distribution-run-tool';
export type RunDirectionMode = 'free' | 'angle' | 'snap' | 'vertical';
export type RunDirectionCandidate = {
    direction: RunPoint;
    active: boolean;
};
type RunVector = readonly [number, number, number];
export declare function run3DDirectionCandidates(sourceDirection: RunVector): RunPoint[];
export declare function runHorizontalDirectionCandidates(sourceDirection: RunVector | null): RunPoint[];
export declare function resolveRunDirectionCandidates(start: RunPoint, cursor: RunPoint, sourceDirection: RunVector | null, mode: RunDirectionMode): RunDirectionCandidate[];
export declare function RunDirectionFeedback({ start, cursor, sourceDirection, mode, snapped, onDirectionSelect, }: {
    start: RunPoint;
    cursor: RunPoint;
    sourceDirection: RunVector | null;
    mode: RunDirectionMode;
    snapped: boolean;
    onDirectionSelect?: (direction: RunPoint) => void;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=run-direction-feedback.d.ts.map