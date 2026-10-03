import { type FloorplanAffordance, type ShelfNode } from '@pascal-app/core';
export type ShelfResizePayload = {
    dim: 'width' | 'depth';
    planAxis: [number, number];
};
/**
 * Single drag handler for both shelf size arrows. Mirrors the 3D
 * `shelfWidthHandle` / `shelfDepthHandle` (`anchor: 'center'` — cursor
 * delta `d` along the outward axis grows the dimension by `2·d` so both
 * faces move ±d and the centre stays put).
 */
export declare const shelfResizeAffordance: FloorplanAffordance<ShelfNode>;
/**
 * Whole-shelf rotation drag (floor-plan). Sister to the 3D
 * `shelfRotateHandle` (arc-resize). Cursor angle around the shelf
 * centre drives `rotation[1]` (Y axis). Shelf stores rotation as a
 * `[x, y, z]` tuple — the patch preserves the X / Z slots.
 *
 * Same `- delta` convention as the 3D handle: the floor-plan builder
 * plots the footprint at `-rotation[1]` (see `buildShelfFloorplan`'s
 * `planRy`), so the 2D view rotates the same direction as 3D for the
 * same `rotation` value and the same cursor gesture writes the same
 * sign in both views.
 */
export declare const shelfRotateAffordance: FloorplanAffordance<ShelfNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map