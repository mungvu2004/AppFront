import { type SiteNode } from '@pascal-app/core';
import { type MutableRefObject } from 'react';
export type TerrainBrushFocus = {
    radius: number;
    x: number;
    z: number;
};
/**
 * The brush ring, drawn *on the terrain surface* rather than as a flat disc.
 *
 * Following the surface is the whole point: a flat ring on sloped ground tells
 * the user nothing about what the brush will touch, because the footprint is a
 * cylinder in XZ and the interesting question is which part of the slope falls
 * inside it. Sampling the ring's height per segment answers that directly.
 *
 * Updated in `useFrame` from a ref, never through React state — the ring tracks
 * the pointer, and routing that through a re-render would re-run every hook in
 * the tool subtree at pointer rate.
 *
 * On `EDITOR_LAYER`, non-negotiably: an overlay mesh left on the scene layer
 * poisons the MRT scene pass and makes FrontSide geometry render see-through.
 */
export declare const TerrainBrushCursor: React.FC<{
    focusRef: MutableRefObject<TerrainBrushFocus | null>;
    site: SiteNode;
}>;
export default TerrainBrushCursor;
//# sourceMappingURL=terrain-brush-cursor.d.ts.map