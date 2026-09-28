import { type AnyNode } from '@pascal-app/core';
import { type GlbInteractiveItem } from './glb-interactive';
/** A building floor discovered in the baked GLB, ordered bottom-to-top. */
export type GlbLevel = {
    id: `level_${string}`;
    label: string;
};
/** pascalId → display info, reported so a host can label the breadcrumb. */
export type GlbIdentity = Record<string, {
    kind: string;
    label: string;
}>;
/** What the cursor would act on at the current drill depth (for a hover label). */
export type GlbHover = {
    kind: string;
    label: string;
} | null;
/** Walkthrough HUD state, reported each frame: the floor/room the camera is in
 *  and the interactive part directly in view (for the reticle prompt). */
export type GlbWalkthrough = {
    zoneLabel: string | null;
    floorLabel: string | null;
    door: {
        label: string;
        isOpen: boolean;
        verb?: string;
    } | null;
} | null;
/**
 * GLB-consuming viewer scene (plan phase 2). Loads a baked artifact and drives
 * the editor's presentation/interaction with no parametric scene graph. Hover
 * and click resolve through the drill hierarchy (building → level → zone →
 * object): the cursor targets the floor in the building view, the room or
 * structure in a level, and items/structure inside a room. Selection feeds the
 * existing outline post-FX, openables play their baked clips, and the shared
 * `useViewer.selection` (with its hierarchy guard) holds the drill state. The
 * host disables the parametric `SelectionManager` (`selectionManager="custom"`).
 */
export declare function GlbScene({ url, interactiveItems, referenceNodes, replaceNodes, onLevelsChange, onIdentityChange, onHoverChange, onWalkthroughChange, }: {
    url: string;
    /** Light / animation effects + controls recovered from the DB scene graph,
     *  joined to the baked nodes by `pascalId` to re-light + re-animate the GLB. */
    interactiveItems?: GlbInteractiveItem[];
    /** Scan / guide nodes from the scene graph, re-added at runtime (they're
     *  stripped from the bake). Already filtered by the privacy flags upstream. */
    referenceNodes?: AnyNode[];
    /** `bake: 'replace'` nodes (e.g. plugin trees): baked static but re-rendered
     *  live here via their `bakeReplaceRenderer`; the baked meshes are hidden. */
    replaceNodes?: AnyNode[];
    onLevelsChange?: (levels: GlbLevel[]) => void;
    onIdentityChange?: (identity: GlbIdentity) => void;
    onHoverChange?: (hover: GlbHover) => void;
    onWalkthroughChange?: (state: GlbWalkthrough) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=glb-scene.d.ts.map