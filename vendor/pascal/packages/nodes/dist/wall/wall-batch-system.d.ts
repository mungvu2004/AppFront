import { type WallMode } from '@pascal-app/viewer';
import { type Material, Mesh } from 'three';
export declare function revealBatchedWallsForCapture(): void;
export declare function holdBatchedWallsAfterCapture(): void;
export type WallBatchCandidate = {
    nodeId: string;
    mesh: Mesh;
    materials: Material[];
};
/**
 * Whether a level's walls may be merged at all right now.
 *
 * The merged mesh captures one material set when it is sewn and nothing
 * re-reads it, so batching is only sound while every batched wall's materials
 * hold still. That is true in `up`; in `cutaway`, walls stamped `wallHidden`
 * are released per wall in the same frame because WallCutout runs at priority
 * 0 and this system at 5. `down` and `translucent` make every wall see-through.
 * Isolation is the other stand-down: it hides the level root the merged mesh
 * hangs off, which would leave a focused batched wall drawn by nobody.
 */
export declare function canBatchWalls(wallMode: WallMode, isolationActive: boolean): boolean;
/**
 * Walls the viewer is currently lighting up — a selection, or any hover.
 *
 * A selection or delete hover paints the wall by swapping the materials on its
 * own mesh, which the merged mesh does not follow. Every other hover draws an
 * outline instead, and that needs the same thing for a different reason: the
 * outline node renders `outliner.hoveredObjects` through the main camera, which
 * enables no batched layer, so a sewn wall reaches neither mask pass and
 * hovering it lights up nothing at all — in select mode, and in paint mode
 * where the outline is the only signal for which surface the next click lands
 * on.
 *
 * Both wants are the same one: a lit wall goes back to drawing its own
 * geometry. Only ever a handful are lit at once, and a handful of extra draw
 * calls is what lighting them costs.
 */
export declare function collectTintedWalls(wallIds: ReadonlySet<string>): Set<string>;
export declare function collectWallBatchCandidates(levelId: string, excludedNodeIds?: ReadonlySet<string>): Map<string, WallBatchCandidate[]>;
export declare const WallBatchSystem: () => null;
/**
 * Follows the scene's dirty tracking rather than watching the walls itself.
 *
 * A wall changes for exactly one reason the merged mesh cares about: the wall
 * system rebuilt its geometry. That system already runs off `dirtyNodes`, so
 * this reads the same signal from both ends — the marks still standing when
 * this frame reaches us, and the rebuild notices the wall system left behind
 * for the walls whose marks it has already cleared. Nothing here re-derives
 * "did this wall move" on its own, and the per-frame cost is the size of the
 * dirty set rather than the size of the floor.
 */
export declare function runBatchFrame(invalidate: () => void, wakeRef: {
    current: ReturnType<typeof setTimeout> | null;
}): void;
//# sourceMappingURL=wall-batch-system.d.ts.map