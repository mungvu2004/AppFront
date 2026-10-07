import { type RoofSegmentNode } from '@pascal-app/core';
/**
 * Shared eave-snap math for the gutter's placement + move tools.
 *
 * `resolveEaveSnap` finds the drip edge of the eave closest to a
 * cursor hit in segment-local coords. It supports every roof type the
 * segment renderer can produce; the difference vs the original
 * `±Z`-only resolver is hip/flat awareness (4-way eave instead of 2)
 * and shed's single low eave.
 *
 * Why this lives outside the tools: the two tool files used to inline
 * an identical copy of the resolver + the tuck constants, with a
 * "keep in sync" comment that becomes a landmine as soon as the
 * resolver grows non-trivial. Hip's 4-way picker pushed it past that
 * threshold.
 */
export declare const EAVE_TUCK_INWARD = 0.04;
export declare const EAVE_TUCK_UP = 0.04;
export type EaveSide = '+X' | '-X' | '+Z' | '-Z';
export type EaveSnap = {
    /** Segment-local X of the snapped gutter position. */
    eaveX: number;
    /** Segment-local Y of the snapped gutter position (drip-edge Y). */
    eaveY: number;
    /** Segment-local Z of the snapped gutter position. */
    eaveZ: number;
    /**
     * Gutter's segment-local Y rotation: orients gutter's outward axis
     * (+Z local) toward the side picked. Length axis (+X local) falls
     * out along the eave direction (±X or ±Z depending on the side).
     */
    rotation: number;
    /** Which side of the segment the snap landed on. */
    side: EaveSide;
};
/**
 * Live eave Y from a segment's wallHeight + overhang + pitch. Pulled
 * out as a shared helper because the renderer derives Y from this same
 * formula on every frame (the gutter tracks the segment's height
 * instead of trusting `node.position[1]` from placement time), and
 * `resolveEaveSnap` uses the same formula at placement.
 */
export declare function computeEaveY(segment: Pick<RoofSegmentNode, 'wallHeight' | 'overhang' | 'pitch' | 'roofType'>): number;
export declare function resolveEaveSnap(segment: RoofSegmentNode, localX: number, localZ: number): EaveSnap;
//# sourceMappingURL=eave-snap.d.ts.map