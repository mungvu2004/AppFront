import type { BoxVentNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Floor-plan builder for a box vent — a small attic-exhaust vent on a roof
 * slope. Seen from above it reads as its footprint per style: `box` is a
 * cover with an inset riser, `cap` flares to a flange past the body, and
 * `dome` is a flush ellipse.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → vent), same as the chimney builder. `position`
 * is segment-local (X = width, Z = depth; Y ignored — anchored to the
 * slope). `rotation` is yaw. Rotations negated for the floor plan's y-down
 * convention.
 */
export declare function buildBoxVentFloorplan(node: BoxVentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map