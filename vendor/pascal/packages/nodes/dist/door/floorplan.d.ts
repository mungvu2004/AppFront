import type { DoorNode, FloorplanGeometry, GeometryContext } from '@pascal-app/core';
/**
 * Stage C floor-plan builder for door. 1:1 visual port of the legacy
 * floorplan-panel door rendering:
 *
 *   1. The door footprint rectangle in the wall cutout (themed
 *      accent stroke when selected).
 *   2. The door swing arc — a fixed quarter-circle from the hinge to
 *      the door's fully-open (90°) position, oriented by `hingesSide`
 *      and `swingDirection`. The angle is intentionally constant so the
 *      plan symbol stays static regardless of the door's live open-close
 *      state. Renders as a wedge of low-opacity fill so the swept area
 *      reads at a glance.
 *   3. The door leaf — a thick line from the hinge to the open
 *      position, terminating at the arc end.
 *
 * Double / french doors render two mirrored half-width leaves hinged at
 * the opposite outer ends, each with its own dashed arc, meeting
 * perpendicular at the centre — the standard double-door plan sign.
 *
 * Folding / bifold doors render a static zigzag accordion of panels
 * across the opening (porting the 3D folding geometry's panel layout),
 * with no swing arc.
 *   4. Center line through the cutout (matches the legacy's
 *      `getOpeningCenterLine` segment for visual continuity).
 *
 * Requires `ctx.parent` to be a wall (door.parentId is the wall it's
 * mounted on). Returns null when the parent isn't a wall (orphaned
 * doors during placement etc.).
 *
 * Swing leaves include hinge / strike indicators and panic hardware
 * when present. Rounded and arched heads are shown as dashed overhead
 * lines because their geometry sits above the horizontal plan cut.
 */
export declare function buildDoorFloorplan(node: DoorNode, ctx: GeometryContext): FloorplanGeometry | null;
//# sourceMappingURL=floorplan.d.ts.map