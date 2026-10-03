import type { ZoneNode as ZoneNodeType } from '@pascal-app/core';
import type { WallPlanPoint } from '../tools/wall/wall-drafting';
type ModifierKeys = {
    meta: boolean;
    ctrl: boolean;
    shift: boolean;
    /** Alt alone: select one session-group member without expanding. */
    alt: boolean;
};
type ResolveFloorplanBackgroundSelectionArgs = {
    canSelectElementFloorplanGeometry: boolean;
    canSelectFloorplanZones: boolean;
    currentSelectedIds: string[];
    /** Session-group expand on plain click (not on modifier/Alt). */
    expandIdsForNode?: (nodeId: string) => string[] | null;
    getFloorplanHitIdAtPoint: (planPoint: WallPlanPoint) => string | null;
    isWallBuildActive: boolean;
    modifierKeys: ModifierKeys;
    planPoint: WallPlanPoint;
    structureLayer: string;
};
export type FloorplanBackgroundSelectionResult = {
    handled: true;
    kind: 'select-zone';
    zoneId: ZoneNodeType['id'];
} | {
    handled: true;
    kind: 'select-elements';
    selectedIds: string[];
} | {
    handled: true;
    kind: 'clear-zones';
} | {
    handled: true;
    kind: 'clear-elements';
    preserveSelection: boolean;
} | {
    handled: false;
};
export declare function resolveFloorplanBackgroundSelection({ canSelectElementFloorplanGeometry, canSelectFloorplanZones, currentSelectedIds, expandIdsForNode, getFloorplanHitIdAtPoint, isWallBuildActive, modifierKeys, planPoint, structureLayer, }: ResolveFloorplanBackgroundSelectionArgs): FloorplanBackgroundSelectionResult;
export {};
//# sourceMappingURL=floorplan-background-selection.d.ts.map