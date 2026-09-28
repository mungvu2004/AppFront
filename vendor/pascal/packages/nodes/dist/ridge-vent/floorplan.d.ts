import type { FloorplanGeometry, GeometryContext, RidgeVentNode } from '@pascal-app/core';
/**
 * Floor-plan builder for a ridge vent — a ventilation strip running along
 * a roof ridge. Seen from above it's a long thin band straddling the
 * ridge crest, with a centre crest line, end caps where closed, and tab
 * dividers for the shingled style.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → vent), same as the chimney builder. `position`
 * is segment-local; the run (`length`) is along local +X and the small
 * cross-`width` straddles the ridge along local Z (centred at Z = 0).
 * `rotation` is yaw, negated for the floor plan's y-down convention.
 */
export declare function buildRidgeVentFloorplan(node: RidgeVentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map