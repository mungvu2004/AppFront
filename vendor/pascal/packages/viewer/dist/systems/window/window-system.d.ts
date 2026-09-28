import { type WindowNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const CASEMENT_WINDOW_SASH_NAME = "casement-window-sash";
export declare const FRENCH_CASEMENT_LEFT_SASH_NAME = "french-casement-left-sash";
export declare const FRENCH_CASEMENT_RIGHT_SASH_NAME = "french-casement-right-sash";
export declare const SLIDING_WINDOW_ACTIVE_PANEL_NAME = "sliding-window-active-panel";
export declare const SINGLE_HUNG_ACTIVE_SASH_NAME = "single-hung-active-sash";
export declare const DOUBLE_HUNG_TOP_SASH_NAME = "double-hung-top-sash";
export declare const DOUBLE_HUNG_BOTTOM_SASH_NAME = "double-hung-bottom-sash";
export declare const LOUVERED_WINDOW_SLATS_NAME = "louvered-window-slats";
export declare const AWNING_WINDOW_SASH_NAME = "awning-window-sash";
export declare const HOPPER_WINDOW_SASH_NAME = "hopper-window-sash";
export declare const pendingWindowAnimationRebuilds: Set<`building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `roof_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `zone_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `site_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `rseg_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}`>;
export declare const WindowSystem: () => null;
/**
 * Build a fresh window mesh for preview/ghost rendering.
 * Returns a mesh with an invisible hitbox root and visible children (frame, glass, sash, hardware).
 */
export declare function buildWindowPreviewMesh(node: WindowNode): THREE.Mesh;
//# sourceMappingURL=window-system.d.ts.map