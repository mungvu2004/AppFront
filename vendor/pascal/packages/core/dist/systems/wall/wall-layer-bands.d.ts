import { type ResolvedAssembly } from '../../lib/assembly-stack.js';
import type { Assembly, WallNode } from '../../schema/index.js';
import { type Point2D, type WallMiterData } from './wall-mitering.js';
/**
 * One assembly layer's share of a wall's plan footprint (F2 band math).
 * `back` and `front` are the band's faces as signed offsets from the wall
 * centreline along the front normal (+n), so `back < front` and the front
 * face of the wall is at +thickness/2.
 */
export type WallLayerBand = {
    layerId: string;
    back: number;
    front: number;
    /** The mitred footprint ∩ the band's offset strip, as counter-clockwise plan rings. */
    polygons: Point2D[][];
};
export type WallLayerBands = ResolvedAssembly & {
    bands: WallLayerBand[];
};
/**
 * Slices a wall's mitred plan footprint into the bands of an assembly's layers
 * (F2 band math). Pure: nothing reads it yet (WL-02 extrudes the bands).
 *
 * The stack sets the body, so the bands tile exactly the footprint that
 * mitering, rooms and 2D already use once `thickness` holds the layer sum. A
 * wall whose stored thickness disagrees gets the `assembly.thickness-mismatch`
 * diagnostic and no bands: it keeps its plain body until a writer re-derives
 * the thickness. Layers stack from the front face (+n), or from the exterior
 * face with `face: 'exterior'` (`resolveWallExteriorSide`, front as fallback).
 *
 * Straight walls intersect the footprint with half-plane strips through the
 * core polygon booleans, which handles the junction vertex a mitred end cap
 * may carry. A curved footprint's end caps are single segments, so its bands
 * resample the footprint's own arcs at the band offsets and interpolate along
 * each cap.
 */
export declare function getWallLayerBands(wall: WallNode, assembly: Assembly, miterData: WallMiterData): WallLayerBands;
//# sourceMappingURL=wall-layer-bands.d.ts.map