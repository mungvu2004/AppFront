import type { FloorplanGeometry, GeometryContext, GutterNode } from '@pascal-app/core';
/**
 * Floor-plan builder for a gutter. A gutter is a thin rain-water channel
 * hosted on a roof segment, running along an eave. In plan it reads as a
 * narrow metal strip just outboard of the eave line: the trough (two long
 * edges), end caps where the trough is closed, hanger straps across the
 * run, and a downspout outlet symbol where one is fitted.
 *
 * The coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → gutter). The gutter's `position` is
 * segment-local and the segment's is roof-local, so we compose
 *   world = roof.pos + R(roof) · (seg.pos + R(seg) · gutter.pos)
 * using the floor-plan's negated-rotation convention (see
 * `buildRoofSegmentFloorplan`). Gutter-local +X is the run (along the
 * eave); +Z hangs outward, away from the building.
 */
export declare function buildGutterFloorplan(node: GutterNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map