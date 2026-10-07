import type { ChimneyNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Floor-plan builder for a chimney. A chimney is a masonry stack hosted on
 * a roof segment. Seen from above it reads as its crown/cap footprint with
 * the body shaft nested inside (the cap overhangs the body) and the flue
 * openings poking out the top.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → chimney). The chimney's `position` is
 * segment-local (X = width axis, Z = depth axis; Y is ignored — the 3D
 * renderer anchors it to the slope). `rotation` is yaw. We compose with
 * the floor-plan's negated-rotation convention (see
 * `buildRoofSegmentFloorplan`). Unlike the gutter there's no eave/overhang
 * offset — a chimney sits at its own footprint, not on the drip edge.
 */
export declare function buildChimneyFloorplan(node: ChimneyNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map