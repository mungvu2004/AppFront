export type PerfCounterBucket = {
    totalMs: number;
    maxMs: number;
    count: number;
};
/** DevTools palette names accepted by the extensibility API. */
export type PerfTrackColor = 'primary' | 'primary-light' | 'primary-dark' | 'secondary' | 'secondary-light' | 'secondary-dark' | 'tertiary' | 'tertiary-light' | 'tertiary-dark' | 'error';
type PerfSampleListener = (track: string, ms: number) => void;
export declare function subscribePerfSamples(listener: PerfSampleListener): () => void;
/**
 * Time a synchronous block and file it under `track`. The label defaults to
 * the track name; pass `name` for per-entry granularity (e.g. a node id) —
 * it only affects the DevTools lane, not the aggregate bucket.
 */
export declare function timeSpan<T>(track: string, fn: () => T, opts?: {
    name?: string;
    color?: PerfTrackColor;
    properties?: Array<[string, string]>;
}): T;
/**
 * Span for non-callback shapes (spans crossing await points or frames).
 * `beginSpan` returns null when perf is off — callers pass the handle back to
 * `endSpan`, which no-ops on null.
 */
export type PerfSpanHandle = {
    track: string;
    name: string;
    start: number;
    color: PerfTrackColor;
};
export declare function beginSpan(track: string, opts?: {
    name?: string;
    color?: PerfTrackColor;
}): PerfSpanHandle | null;
export declare function endSpan(handle: PerfSpanHandle | null, properties?: Array<[string, string]>): void;
/** Record a duration measured externally (no measure emitted). */
export declare function recordPerfSample(track: string, ms: number): void;
/** Hand the current window's buckets to the overlay and start a new window. */
export declare function drainPerfCounters(): Map<string, PerfCounterBucket>;
/** Drop accumulated timeline entries so long `?perf` sessions don't leak. */
export declare function clearPerfMeasures(): void;
export {};
//# sourceMappingURL=perf-tracks.d.ts.map