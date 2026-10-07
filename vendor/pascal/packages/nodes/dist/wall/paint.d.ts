import { type PaintCapability, type WallNode } from '@pascal-app/core';
import { type Ray } from 'three';
/**
 * Resolve which wall face band the user clicked. The side comes from:
 *   1. Material-slot index from the renderer's groups. Cheap reference path.
 *   2. Falls back to the hit-surface normal + local-Z when the
 *      groups aren't conclusive. Front/back of the wall maps to the
 *      node's `frontSide` / `backSide` semantic; absent that, front
 *      → interior, back → exterior.
 *
 * Returns null when the click is too oblique (or lands on the wall's
 * end-cap, etc.) to confidently assign a side.
 */
export declare function resolveWallRole(args: {
    node: WallNode;
    hitObject?: {
        userData?: {
            slotId?: unknown;
        };
    };
    materialIndex: number | null;
    normal: readonly [number, number, number] | undefined;
    localPosition: readonly [number, number, number] | undefined;
    ray?: Ray;
}): string | null;
/**
 * Capability binding for the wall kind on the unified slot model. Painting
 * writes `node.slots[bandSide]` (a `library:` ref or a minted `scene:`
 * material) exactly like every other kind; `legacyEffective` reads the
 * whole-side fallback so old scenes still show the current value.
 */
export declare const wallPaint: PaintCapability;
//# sourceMappingURL=paint.d.ts.map