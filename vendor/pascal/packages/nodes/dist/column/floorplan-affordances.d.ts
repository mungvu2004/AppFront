import { type ColumnNode, type FloorplanAffordance } from '@pascal-app/core';
/**
 * One drag pattern for every column size handle. The arrow's outward
 * direction in plan coords (`planAxis`) is captured at emit-time; the
 * affordance projects the cursor along that axis and applies the delta
 * to the dimension named by `dim`.
 *
 * Sign / factor mirror the 3D `column/definition.ts` handles:
 *
 *   - `width` / `depth` / `uniform` / `brace-width` / `brace-depth` /
 *     `brace-bottom-spread` / `brace-top-spread`: `anchor: 'center'` —
 *     a cursor delta of `d` along the outward axis grows the dimension
 *     by `2·d` (both faces move ±d so the centre stays put).
 *   - `radius`: `kind: 'radial-resize'` — cursor delta `d` grows the
 *     radius by `d` (the visible edge follows the cursor 1:1).
 */
export type ColumnResizePayload = {
    dim: 'width' | 'depth' | 'uniform' | 'radius' | 'brace-width' | 'brace-depth' | 'brace-bottom-spread' | 'brace-top-spread';
    planAxis: [number, number];
};
export declare const columnResizeAffordance: FloorplanAffordance<ColumnNode>;
/**
 * Column rotation drag (floor-plan). Sister to the 3D
 * `columnRotateHandle` (arc-resize). Same `- delta` convention as the
 * 3D handle: the floor-plan builder plots the footprint at
 * `-column.rotation` (see `buildColumnFloorplan`'s `rot = -node.rotation`),
 * so the 2D view rotates the same direction as 3D for the same
 * `rotation` value, and the same cursor gesture writes the same sign
 * in both views.
 */
export declare const columnRotateAffordance: FloorplanAffordance<ColumnNode>;
//# sourceMappingURL=floorplan-affordances.d.ts.map