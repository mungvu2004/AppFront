import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
import { type ActiveInteractionScope, type InteractionScope } from '../lib/interaction/scope';
type SubtreeCreation = {
    rootId: AnyNodeId;
    node: AnyNode;
    hydrationId: object | null;
};
type OwnedSubtree = {
    creation: SubtreeCreation;
    gesture: object;
};
export type InteractionScopeState = {
    scope: InteractionScope;
    gesture: object | null;
    pendingSubtree: SubtreeCreation | null;
    ownedSubtree: OwnedSubtree | null;
    noteSubtreeCreation: (node: AnyNode) => void;
    adoptSubtree: (rootId: AnyNodeId) => boolean;
    finishSubtree: (rootId: AnyNodeId) => void;
    begin: (scope: ActiveInteractionScope) => void;
    update: (patch: Partial<ActiveInteractionScope>) => void;
    end: () => void;
    endIf: (match: (scope: ActiveInteractionScope) => boolean) => void;
};
declare const useInteractionScope: import("zustand").UseBoundStore<import("zustand").StoreApi<InteractionScopeState>>;
export declare function isInteractionSubtreeDraft(rootId?: `roof_${string}` | `rseg_${string}` | `site_${string}` | `building_${string}` | `level_${string}` | `elevator_${string}` | `unit_${string}` | `zone_${string}` | `block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}` | `leanto_${string}` | `door_${string}` | `window_${string}` | `cabinet_${string}` | `cabinet-module_${string}` | `sseg_${string}` | `bvent_${string}` | `rvent_${string}` | `tvent_${string}` | `cupola_${string}` | `eyebrow-vent_${string}` | `gutter_${string}` | `chimney_${string}` | `solarpanel_${string}` | `skylight_${string}` | `dormer_${string}` | `downspout_${string}` | undefined): boolean;
export declare const useActiveHandleDrag: () => {
    nodeId: string;
    label: string;
} | null;
export declare const useEditingHole: () => {
    nodeId: string;
    holeIndex: number;
} | null;
export declare const getEditingHole: () => {
    nodeId: string;
    holeIndex: number;
} | null;
export declare const getIsCurveReshape: () => boolean;
export declare const useIsCurveReshape: () => boolean;
export declare const useIsToolDrivenReshape: () => boolean;
export declare const useIsFloorplanDrivenReshape: () => boolean;
export declare const useEndpointReshape: () => {
    nodeId: string;
    endpoint: "start" | "end";
} | null;
export declare const useControlPointReshape: () => {
    nodeId: string;
    index: number;
} | null;
export declare const useTangentReshape: () => {
    nodeId: string;
    index: number;
    side: "in" | "out";
} | null;
export declare const useReshapingNode: () => AnyNode | null;
export declare const useMovingNode: () => AnyNode | null;
export declare const getMovingNode: () => AnyNode | null;
export default useInteractionScope;
//# sourceMappingURL=use-interaction-scope.d.ts.map