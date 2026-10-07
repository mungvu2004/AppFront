import type { SnapProfile } from '@pascal-app/core';
/**
 * Snapping mode is a single global, user-cyclable control that maps onto the
 * two pre-existing snap knobs (`gridSnapStep` grid snap + `magneticSnap`).
 * Each context chooses its own default. Item movement defaults to magnetic
 * alignment so a picked-up group catches neighboring geometry; grid and off
 * remain explicit alternatives in the contextual chip.
 */
export type SnappingMode = 'grid' | 'lines' | 'angles' | 'off';
export declare const SNAPPING_MODES: SnappingMode[];
export declare const DEFAULT_SNAPPING_MODE: SnappingMode;
export type SnapFlags = {
    grid: boolean;
    magnetic: boolean;
    angles: boolean;
};
/**
 * Pure mapping from the mode enum onto the individual snap knobs. Modes are
 * EXCLUSIVE — each does exactly what its chip label says, one guide at a time,
 * so the HUD is honest:
 *
 * - `grid`   → grid lattice only.
 * - `lines`  → magnetic only: alignment axes + wall corner-join (connectivity
 *   is part of the "lines" magnetic snap, not a separate always-on behaviour).
 * - `angles` → angle lock only (15°/45° rays).
 * - `off`    → nothing snaps (raw cursor).
 */
export declare function resolveSnapFlags(mode: SnappingMode): SnapFlags;
export declare function getSnappingModeLabel(mode: SnappingMode): string;
export declare function nextSnappingMode(mode: SnappingMode): SnappingMode;
export type SnapContext = 'wall' | 'item' | 'polygon' | 'rotation';
export declare const SNAP_CONTEXTS: SnapContext[];
export declare function snappingModesFor(context: SnapContext): SnappingMode[];
export declare function defaultSnappingModeFor(context: SnapContext): SnappingMode;
export declare function cycleSnappingModeIn(context: SnapContext, mode: SnappingMode): SnappingMode;
/**
 * The active snapping context, derived from what the user is doing — fully
 * node-declared: the kind's `snapProfile` (looked up via the injected
 * `profileOf`) supplies the data, and this maps (profile × action) to the
 * mode-set. No per-kind switch lives here. `profileOf` is injected so this stays
 * pure + testable and `snapping-mode` need not import the registry.
 *
 * Prefers the authoritative interaction scope; falls back to the build tool
 * because the `drafting` scope isn't wired yet (wall/slab draw runs idle).
 * Returns null when nothing snappable is active → no chip, safe-default snap.
 */
export declare function snapContextOf(args: {
    scope: {
        kind: string;
        nodeType?: string;
        reshape?: string;
        nodeId?: string;
        tool?: string;
        handle?: string;
        operator?: string;
    };
    mode: string;
    tool: string | null;
    profileOf: (typeOrTool: string) => SnapProfile | undefined;
    profileOfNode?: (nodeId: string) => SnapProfile | undefined;
    draftDirectionalOf?: (typeOrTool: string) => boolean;
}): SnapContext | null;
//# sourceMappingURL=snapping-mode.d.ts.map