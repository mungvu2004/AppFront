import { type ReactNode } from 'react';
/**
 * Wraps a placement tool's preview/ghost so it rides the active level's
 * stacked elevation.
 *
 * Placement tools are mounted inside the building-local group (see the editor's
 * ToolManager), which carries no per-floor elevation. But their points, ports,
 * and committed paths are level-local (Y=0 = the floor) and the committed nodes
 * parent to the level mesh, which DOES carry the stacked Y offset. Without this
 * the ghost renders at world ground on upper floors while the cursor raycast
 * rides the floor plane — they drift apart. Tracking the level mesh's Y here
 * (the same value the grid plane follows) keeps the preview on the floor being
 * drawn, with no change to any tool's level-local math.
 */
export declare function LevelOffsetGroup({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
//# sourceMappingURL=level-offset-group.d.ts.map