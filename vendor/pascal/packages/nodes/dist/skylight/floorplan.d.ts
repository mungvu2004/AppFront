import type { FloorplanGeometry, GeometryContext, SkylightNode } from '@pascal-app/core';
/**
 * Floor-plan builder for a skylight — a glazed opening set into the roof
 * slope. Seen from above it's the classic skylight symbol: an outer frame
 * rectangle, an inset glass pane, and a diagonal cross over the glass.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → skylight), same as the chimney builder.
 * `position` is segment-local (X = width across slope, Z = height down
 * slope; Y ignored — anchored to the slope). `rotation` is yaw. Rotations
 * negated for the floor plan's y-down convention. The frame extends
 * outward by `frameThickness` past the `width × height` glass opening
 * (matching `frame-csg.ts`).
 */
export declare function buildSkylightFloorplan(node: SkylightNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map