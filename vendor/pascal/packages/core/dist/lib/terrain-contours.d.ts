/**
 * Terrain contour lines (the site plan's and the 3D view's), from the site's heightfield.
 *
 * Marching squares over the field's samples at a chosen interval: every
 * cell whose four corner heights straddle a level gets one or two segments
 * (the saddle case split by the centre height), and the segments are
 * chained into polylines. Only segments whose midpoint lies inside the lot
 * are kept, so the lines stop at the property line the way a survey's do.
 * Elevations are the field's (relative to the site datum, metres); the
 * caller adds the datum for absolute feet when the terrain sample carries
 * one. Pure.
 *
 * Drawn on the site plan at a user-selectable contour interval (6", 12", …).
 */
import { type TerrainField } from './terrain-field.js';
export type Pt = readonly [number, number];
export type Contour = {
    /** The level, site metres above the datum. */
    levelM: number;
    points: Pt[];
    /** Every N-th line is an index contour (heavier, labelled). */
    index: boolean;
};
/**
 * The contours of a field at `intervalM`, clipped to the lot. Every fifth
 * level (counted from zero) is an index contour.
 */
export declare function terrainContours(field: TerrainField, intervalM: number, lot: readonly Pt[]): Contour[];
//# sourceMappingURL=terrain-contours.d.ts.map