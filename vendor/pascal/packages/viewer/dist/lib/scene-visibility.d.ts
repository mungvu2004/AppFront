import type { Object3D } from 'three';
/**
 * Why an object is currently held off the scene layer.
 *
 * - `isolated` — outside the focused subtree of the viewer's isolation filter.
 * - `shadow-only` — solo mode: out of the color passes, still casting shadows.
 * - `batched` — a level's merged wall mesh draws this wall now.
 */
export type HiddenReason = 'isolated' | 'shadow-only' | 'batched' | 'wall-batched';
/** Holds `obj` off the scene layer for `reason`. Idempotent per reason. */
export declare function hideFromScene(obj: Object3D, reason: HiddenReason): void;
/** Drops `reason`, restoring the mask `obj` had before the first one arrived. */
export declare function showInScene(obj: Object3D, reason: HiddenReason): void;
export declare function temporarilyShowShadowOnly(root: Object3D): () => void;
//# sourceMappingURL=scene-visibility.d.ts.map