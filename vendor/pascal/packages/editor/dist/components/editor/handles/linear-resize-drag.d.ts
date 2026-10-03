import { type AnyNode, type AnyNodeId, type HandleDragModifiers, type LinearResizeHandle, type RadialResizeHandle, type SceneApi } from '@pascal-app/core';
export declare function linearResizeFactor<N>(descriptor: LinearResizeHandle<N> | RadialResizeHandle<N>): number;
export declare function createLinearResizeDragBinding({ descriptor, initialNode, nodeId, sceneApi, initialModifiers, }: {
    descriptor: LinearResizeHandle<AnyNode>;
    initialNode: AnyNode;
    nodeId: AnyNodeId;
    sceneApi: SceneApi;
    initialModifiers: HandleDragModifiers;
}): {
    overrideId: `roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}`;
    commit: ((patch: Partial<AnyNode>) => void | undefined) | undefined;
    apply(next: number, modifiers: HandleDragModifiers): Partial<AnyNode>;
    clearPreview(): void;
};
//# sourceMappingURL=linear-resize-drag.d.ts.map