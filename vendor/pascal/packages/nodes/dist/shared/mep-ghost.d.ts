import type { DuctFittingNode, DuctSegmentNode, PipeFittingNode, PipeSegmentNode } from '@pascal-app/core';
/** Indigo-400 — the shared MEP preview accent (matches the draw-tool ghost). */
export declare const GHOST_COLOR = "#818cf8";
export declare const GHOST_OPACITY = 0.55;
/** Tint state for an auto-routed offset preview: green = a buildable offset
 *  that will mint on release, red = no valid offset at this height (the run
 *  lifts as a preview only and snaps back). Undefined = the neutral indigo
 *  preview used everywhere else. */
export type GhostTint = 'valid' | 'invalid' | undefined;
/**
 * Translucent ghost of a duct fitting, built from the same geometry the
 * placed node uses so the preview matches the result. The node carries its
 * level-local `position` / `rotation`, applied here on the group (the
 * renderer normally bakes that in).
 */
export declare function FittingGhost({ fitting, tint }: {
    fitting: DuctFittingNode;
    tint?: GhostTint;
}): import("react").JSX.Element;
/**
 * Translucent ghost of a duct-segment run. Path coords are level-local and
 * the node's transform is identity, so the built group renders at the origin
 * — the same frame the fitting ghosts use.
 */
export declare function DuctSegmentGhost({ duct, tint }: {
    duct: DuctSegmentNode;
    tint?: GhostTint;
}): import("react").JSX.Element;
export declare function PipeFittingGhost({ fitting, tint, }: {
    fitting: PipeFittingNode;
    tint?: GhostTint;
}): import("react").JSX.Element;
export declare function PipeSegmentGhost({ pipe, tint }: {
    pipe: PipeSegmentNode;
    tint?: GhostTint;
}): import("react").JSX.Element;
//# sourceMappingURL=mep-ghost.d.ts.map