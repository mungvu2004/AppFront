import type { DormerNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Floor-plan builder for a dormer — a small house-shaped structure that
 * projects from a roof slope, with its own little roof and a window on the
 * front face. Seen from above it reads as a `width × depth` footprint plus
 * its roof's ridge/hip linework, and a line marking the window on the
 * down-slope (+Z) front face.
 *
 * Coordinate frame mirrors the 3D transform stack
 * (roof → roof-segment → dormer), same as the chimney builder. The
 * dormer's `position` is segment-local: X = width axis (along the eave),
 * Z = depth axis (projecting down-slope; +Z is the front/window face).
 * `rotation` is yaw. Rotations are negated for the floor plan's y-down
 * convention (see `buildRoofSegmentFloorplan`).
 *
 * Per-type roof linework follows the dormer's own roof geometry
 * (`buildDormerCutShape` in csg-geometry.ts): gable ridge runs along Z,
 * shed arrows follow the configured high-to-low direction, and hip ridges
 * run along the longer axis. Gambrel falls back to gable; dutch/mansard to
 * hip — the same fallbacks the 3D cut uses.
 */
export declare function buildDormerFloorplan(node: DormerNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map