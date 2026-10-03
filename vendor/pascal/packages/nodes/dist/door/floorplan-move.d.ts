import { type DoorNode, type FloorplanMoveTarget } from '@pascal-app/core';
/**
 * 2D floor-plan move handler for door — kicks in when the user clicks
 * "Move" on the door inspector (or action menu) and the floor-plan
 * view is active. Pointer in plan space → snap to nearest wall →
 * project onto wall axis → snap local-X to 0.5m grid → clamp inside
 * wall bounds → commit via `useScene.updateNodes`.
 *
 * Mirrors the 3D `move-tool.tsx` behaviour minus the R3F event plumbing:
 *   - Re-parents on transition between walls (parentId + wallId).
 *   - Adapts `side` + `rotation` from the wall normal under the pointer.
 *   - hasWallChildOverlap blocks committing overlapping placements.
 *
 * Curved walls are skipped by `findClosestWallInPlan` — same guardrail
 * as the 3D port and the legacy `DoorTool` / `MoveDoorTool`.
 */
export declare const doorFloorplanMoveTarget: FloorplanMoveTarget<DoorNode>;
//# sourceMappingURL=floorplan-move.d.ts.map