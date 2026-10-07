/**
 * Holds the viewport's LAST presented frame on screen while a capture works
 * on the shared scene: the frame loop keeps ticking (useFrame systems still
 * run, a capture can pump frames by hand) but the live draw is skipped, so
 * whatever a capture swaps in for its own renders — a presentation flip, a
 * hidden ground, an override material held across a GPU readback — never
 * reaches the canvas.
 *
 * Holds nest; each one expires on its own after `maxMs` so a capture that
 * never settles cannot freeze the viewport for the session.
 */
export declare function holdLiveFrame(maxMs?: number): () => void;
export declare function isLiveFrameHeld(): boolean;
//# sourceMappingURL=live-frame-hold.d.ts.map