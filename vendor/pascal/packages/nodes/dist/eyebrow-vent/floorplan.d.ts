import type { EyebrowVentNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Floor-plan builder for an eyebrow vent — seen from above it reads as the
 * lens (eye-shaped) footprint of the hood, with a faint centre seam. The
 * coordinate frame mirrors the 3D transform stack (roof → roof-segment →
 * vent), same as the box-vent / cupola builders.
 */
export declare function buildEyebrowVentFloorplan(node: EyebrowVentNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map