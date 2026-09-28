import type { FloorplanGeometry, GeometryContext, TurbineVentNode } from '@pascal-app/core';
/**
 * Floor-plan builder for a turbine vent — seen from above it reads as the
 * round flange flashing with the head circle inside and short radial ticks
 * suggesting the vanes.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → vent), same as the box-vent builder. `position`
 * is segment-local; `rotation` is yaw; rotations are negated for the floor
 * plan's y-down convention.
 */
export declare function buildTurbineVentFloorplan(node: TurbineVentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map