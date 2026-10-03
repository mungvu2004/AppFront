import { type FloorplanMoveTarget, type WindowNode } from '@pascal-app/core';
/**
 * 2D floor-plan move handler for window. Same shape as door (see
 * `nodes/src/door/floorplan-move.ts`) — pointer in plan space → snap
 * to nearest wall → project onto wall axis → snap local-X to 0.5m →
 * clamp inside wall bounds → commit.
 *
 * Window-specific: local Y (vertical position on the wall) is preserved
 * from the source node — we don't try to reposition the sill from a 2D
 * pointer (there's no Y signal in plan view). The 3D move tool handles
 * vertical motion; the 2D move is a horizontal-only re-anchor.
 */
export declare const windowFloorplanMoveTarget: FloorplanMoveTarget<WindowNode>;
//# sourceMappingURL=floorplan-move.d.ts.map