import { type SiteNode } from '@pascal-app/core';
/**
 * The site plan only has something to draw for a resolved lot (a parcel or
 * setbacks on the site) or when a plugin contributes site-plan content; every
 * other scene would get the default 30 m square.
 */
export declare function isSitePlanAvailable(site: Pick<SiteNode, 'parcel' | 'setbacks'> | null, pluginContributes: boolean): boolean;
export declare function useSitePlanAvailable(): boolean;
/**
 * Floor plan ⇄ Site plan switch for the 2D editor.
 *
 * Sits with the other floating plan controls in the floor-plan viewport
 * (bottom-left, beside the compass). Theme tokens only. Hidden, and a
 * persisted site-plan choice reset to the floor plan, when the scene has no
 * site plan to show.
 */
export declare function FloorplanDrawingTypeSwitch({ className }: {
    className?: string;
}): import("react").JSX.Element | null;
//# sourceMappingURL=drawing-type-switch.d.ts.map