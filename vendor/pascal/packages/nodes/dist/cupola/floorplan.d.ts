import type { CupolaNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Floor-plan builder for a cupola — seen from above it reads as the
 * overhanging cornice/roof square with the louvered body square inside.
 * Coordinate frame mirrors the 3D transform stack (roof → roof-segment →
 * cupola), same as the box-vent builder.
 */
export declare function buildCupolaFloorplan(node: CupolaNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map