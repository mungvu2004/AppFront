import { type FloorplanGeometry, type GeometryContext, type ItemNode } from '@pascal-app/core';
/**
 * Stage C floor-plan builder for item.
 *
 * Items can be parented to a wall, ceiling, slab, or another item.
 * Position is in the parent's local frame, so we walk the parent chain
 * via `ctx.resolve` to compute the world-space (level-local) transform.
 *
 * Mirrors `getItemFloorplanTransform` from editor/lib/floorplan/items.ts
 * but uses the registry's resolve callback instead of a node map. Logic
 * is identical so visual output matches the legacy.
 *
 * Returns a rotated rectangle of width × depth at the resolved position.
 * Phase 5 follow-up may render `asset.floorPlanUrl` as a custom image
 * overlay when present.
 */
type Transform = {
    x: number;
    y: number;
    rotation: number;
};
export declare function resolveItemTransform(item: ItemNode, ctx: GeometryContext, cache?: Map<`roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}`, Transform | null>): Transform | null;
export declare function buildItemContextualDimensions(node: ItemNode, ctx: GeometryContext): FloorplanGeometry | null;
export declare function buildItemFloorplan(node: ItemNode, ctx: GeometryContext): FloorplanGeometry | null;
export {};
//# sourceMappingURL=floorplan.d.ts.map