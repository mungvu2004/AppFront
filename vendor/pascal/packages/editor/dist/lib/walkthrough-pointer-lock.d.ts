/**
 * Grab pointer lock on the viewer canvas for a walkthrough (walk / drone)
 * entry. Must run synchronously inside a user-gesture task — callers flip the
 * first-person flags in a `flushSync` first so the controls are mounted when
 * the lock lands.
 *
 * `retryWhile`: the browser's re-lock cooldown (~1.25s after any unlock)
 * rejects the request outright, which bites the natural "free the cursor,
 * immediately pick the other camera" flow. When given, one delayed retry
 * fires after the cooldown — only while the predicate still holds.
 */
export declare function requestWalkthroughPointerLock(options?: {
    retryWhile?: () => boolean;
}): void;
//# sourceMappingURL=walkthrough-pointer-lock.d.ts.map