type FrameLimiterProps = {
    fps?: number;
    paused?: boolean;
    onFrameError?: (cause: unknown) => void;
};
export type FrameClock = {
    sample: (wallTimeMs: number, intervalMs: number) => number | null;
    step: (seconds: number) => number;
};
/**
 * Keeps R3F's manual clock monotonic while each limiter effect owns a fresh
 * wall-time baseline. The first rAF sample establishes that baseline instead
 * of treating the browser's process uptime as elapsed frame time.
 */
export declare function createFrameClock(initialTime?: number): FrameClock;
declare const FrameLimiter: React.FC<FrameLimiterProps>;
export default FrameLimiter;
//# sourceMappingURL=frame-limiter.d.ts.map