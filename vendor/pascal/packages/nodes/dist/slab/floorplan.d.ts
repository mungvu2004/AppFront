import { type FloorplanGeometry, type GeometryContext, type SlabNode } from '@pascal-app/core';
/**
 * Stage C floor-plan builder for slab. Renders the slab polygon as a
 * filled path with holes cut out; when selected, overlays themed
 * chrome (accent stroke, hatch fill) plus the full boundary editor:
 *
 *   - Vertex handles on every polygon corner (orange dots).
 *   - Midpoint `+` handles between vertices to insert a new vertex.
 *   - Edge handles along each edge so the user can drag the whole
 *     edge perpendicular.
 *   - Same three handle sets for every hole in `node.holes`, with the
 *     `holeIndex` carried in each handle's payload.
 *
 * Uses `getRenderableSlabPolygon` for the visible fill (per-edge render
 * offsets against level walls + sibling slabs), but vertex / edge /
 * midpoint handles live on the **raw** `node.polygon` — matches the
 * legacy slab boundary editor which always operates on raw data.
 */
export declare function buildSlabFloorplan(node: SlabNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map