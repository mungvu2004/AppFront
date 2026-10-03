import { type AnyNode, type AnyNodeId, type StairNode } from '@pascal-app/core';
export declare function getBuildingLevelsForLevel(nodes: Record<string, AnyNode>, levelId: AnyNodeId | string | null | undefined): {
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `level_${string}`;
    type: "level";
    children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
    level: number;
    baseElevation: number;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
    height?: number | undefined;
}[];
export declare function getStairLevelOptions(nodes: Record<string, AnyNode>, stair: StairNode): {
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `level_${string}`;
    type: "level";
    children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
    level: number;
    baseElevation: number;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
    height?: number | undefined;
}[];
export declare function resolveStairPlacementLevelId(nodes: Record<string, AnyNode>, preferredLevelId: AnyNodeId | string | null | undefined, preferredBuildingId?: AnyNodeId | string | null): `level_${string}` | null;
export declare function resolveStairFromLevelId(nodes: Record<string, AnyNode>, stair: StairNode, levels?: {
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `level_${string}`;
    type: "level";
    children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
    level: number;
    baseElevation: number;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
    height?: number | undefined;
}[]): string | null;
export declare function resolveStairToLevelId(nodes: Record<string, AnyNode>, stair: StairNode, fromLevelId: AnyNodeId | string | null | undefined, levels?: {
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `level_${string}`;
    type: "level";
    children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
    level: number;
    baseElevation: number;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
    height?: number | undefined;
}[]): string | null;
export declare function resolveStairDestinationLevel({ createMissing, fromLevelId, nodes, }: {
    createMissing?: boolean;
    fromLevelId: AnyNodeId | string | null | undefined;
    nodes: Record<string, AnyNode>;
}): {
    buildingId: `roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}` | null;
    createdLevel: null;
    fromLevel: {
        object: "node";
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        parentId: string | null;
        visible: boolean;
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        type: "level";
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    };
    levels: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        type: "level";
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    }[];
    toLevel: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        type: "level";
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    };
} | {
    buildingId: `roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}`;
    createdLevel: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        type: "level";
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    };
    fromLevel: {
        object: "node";
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        parentId: string | null;
        visible: boolean;
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        type: "level";
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    };
    levels: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        type: "level";
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    }[];
    toLevel: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        id: `level_${string}`;
        type: "level";
        children: (`roof_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`)[];
        level: number;
        baseElevation: number;
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
        height?: number | undefined;
    };
} | null;
//# sourceMappingURL=stair-levels.d.ts.map