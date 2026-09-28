import type { ReactNode } from 'react';
import type { WalkthroughInteract } from '../store/use-first-person-hud';
export type { WalkthroughInteract } from '../store/use-first-person-hud';
export type WalkthroughHudProps = {
    floorLabel?: string | null;
    zoneLabel?: string | null;
    interact?: WalkthroughInteract;
    /** Pointer lock temporarily released (OS screenshot) — the pill flips to
     *  "Click to resume" and lets clicks fall through to the canvas. */
    suspended?: boolean;
    onExit?: () => void;
    children?: ReactNode;
};
/** The centered walkthrough pointer: a dot that grows into a green ring over
 *  an interactable (door / window / elevator). Also mounted by the snapshot
 *  capture overlay so walk / drone framing keeps the same E-to-open pointer. */
export declare function WalkthroughCrosshair({ interact }: {
    interact: WalkthroughInteract;
}): import("react").JSX.Element;
export declare function WalkthroughHud({ floorLabel, zoneLabel, interact, suspended, onExit, children, }: WalkthroughHudProps): import("react").JSX.Element;
//# sourceMappingURL=walkthrough-hud.d.ts.map