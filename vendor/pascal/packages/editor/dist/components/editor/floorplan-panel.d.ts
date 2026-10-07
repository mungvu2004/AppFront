import { type ReactNode } from 'react';
export declare function FloorplanPanel({ 
/**
 * Element to portal the compass button into. The 2D/3D navigation poses stay
 * in sync (`navigationSyncPose`), so hosting the compass on the always-visible
 * viewer-area container keeps it correct — needle and align-to-north alike —
 * in 2d, 3d, and split modes, while this panel itself may be display:none.
 */
compassHost, floorplanSceneSlot, }: {
    compassHost?: HTMLElement | null;
    floorplanSceneSlot?: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=floorplan-panel.d.ts.map