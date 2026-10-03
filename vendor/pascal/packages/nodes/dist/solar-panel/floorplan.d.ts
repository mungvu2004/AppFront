import type { FloorplanGeometry, GeometryContext, SolarPanelNode } from '@pascal-app/core';
/**
 * Floor-plan builder for a solar-panel array — a grid of photovoltaic
 * modules mounted on a roof segment. Seen from above it reads as its
 * `rows × columns` grid of dark module rectangles with gaps between them.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → panel), same as the chimney builder. The array's
 * `position` is segment-local (X = width axis, Z = depth axis; Y is
 * ignored — the 3D renderer anchors it to the slope). `rotation` is yaw.
 * Rotations are negated for the floor plan's y-down convention (see
 * `buildRoofSegmentFloorplan`).
 *
 * The per-module layout matches `buildSolarPanelGeometry` exactly: the
 * array is centred at the origin, modules step by `panel + gap` along each
 * axis (columns along X, rows along Z). A tilted array foreshortens
 * slightly in 3D, but the plan shows its full mounting footprint — that's
 * what matters for roof layout.
 */
export declare function buildSolarPanelFloorplan(node: SolarPanelNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map