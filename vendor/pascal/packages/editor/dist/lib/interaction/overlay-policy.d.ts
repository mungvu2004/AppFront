import { type InteractionScope } from './scope';
export type OverlayVisibility = 'shown' | 'faded' | 'hidden';
export type OverlayPolicy = {
    zoneLabels: OverlayVisibility;
    contextBadges: OverlayVisibility;
    conflictingControls: OverlayVisibility;
    sceneObjectsPickable: boolean;
    activeAffordances: 'shown';
    contextualHudInteractive: boolean;
};
export declare function resolveOverlayPolicy(scope: InteractionScope): OverlayPolicy;
export declare function resolveFloatingActionMenuVisibility(scope: InteractionScope, hasActiveMeasurementPill: boolean): {
    root: boolean;
    actions: boolean;
};
export declare function shouldShowEditingControls(readOnly: boolean): boolean;
//# sourceMappingURL=overlay-policy.d.ts.map