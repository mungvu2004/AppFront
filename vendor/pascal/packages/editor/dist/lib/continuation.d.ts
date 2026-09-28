export type ContinuationContext = 'wall' | 'fence' | 'point' | 'cabinet' | 'canopy';
export type ContinuationMode = string;
export declare const CONTINUATION_PROFILES: Record<ContinuationContext, {
    options: ContinuationMode[];
    default: ContinuationMode;
    labels: Record<string, string>;
    icons: Record<string, string>;
}>;
export declare function nextContinuation(context: ContinuationContext, current: ContinuationMode): ContinuationMode;
export declare function continuationContextOf(kind: string): ContinuationContext | null;
//# sourceMappingURL=continuation.d.ts.map