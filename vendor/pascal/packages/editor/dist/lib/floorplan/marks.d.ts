import type { AnyNode, AnyNodeId, DoorNode, WindowNode } from '@pascal-app/core';
/**
 * Deterministic door / window marks per level — WS3.
 *
 * `packages/core/src/schema/nodes/door.ts:75-79` promises "the deterministic
 * level fallback (101, 102, ...)"; this is the implementation.
 *
 * Numbering
 * ---------
 *   base   = (level.level + 1) * 100          — level 0 → 100, level 1 → 200
 *   doors  = `D${base + n}`   → D101, D102 …
 *   windows= `W${base + n}`   → W101, W102 …
 *
 * Order
 * -----
 * Openings are visited **clockwise** around the level, starting from the
 * north-west-most exterior wall, exterior walls first and interior walls
 * after. Clockwise is the ascending-angle sweep of the wall midpoint about
 * the level centroid, anchored on the north-west diagonal (plan axes are
 * x east, z south — z grows down the screen — so a screen-clockwise sweep
 * is increasing atan2(z, x)). Openings on the same wall are ordered along
 * the wall direction.
 *
 * Stability
 * ---------
 * An explicit `mark` on the node always wins and is never reassigned.
 * `resolveMarks` also reports, in `assignments`, the marks it invented for
 * nodes that had none — the caller is expected to PERSIST those back onto
 * `node.mark` the first time they are resolved in an edit session
 * (`persistResolvedMarks`). That is what makes numbering stable under
 * insertion: once written, an existing opening keeps its number forever and
 * a newly inserted opening only ever takes the next free number. Without
 * the write-back, inserting a door in the middle of a wall would silently
 * renumber every door after it.
 */
export type OpeningMarkKind = 'door' | 'window';
export type MarkResolution = {
    /** Every door and window on the level → its mark. */
    marks: ReadonlyMap<string, string>;
    /** Only the marks that were invented (node.mark was empty). */
    assignments: ReadonlyMap<string, string>;
    /** Duplicate explicit marks and other reportable defects. */
    issues: readonly string[];
};
export type MarkSceneInput = {
    nodes: Readonly<Record<string, AnyNode>>;
};
/**
 * Resolve marks for every door and window under `levelId`.
 *
 * `scene` may be a `{ nodes }` snapshot or the raw node map.
 */
export declare function resolveMarks(scene: MarkSceneInput | Readonly<Record<string, AnyNode>>, levelId: AnyNodeId): Map<string, string>;
export declare function resolveMarkDetail(scene: MarkSceneInput | Readonly<Record<string, AnyNode>>, levelId: AnyNodeId): MarkResolution;
/**
 * Write invented marks back onto the nodes so numbering never drifts.
 *
 * Call once per level per edit session (the caller decides when — this
 * module stays pure). `update` is typically `sceneApi.update`.
 */
export declare function persistResolvedMarks(resolution: MarkResolution, update: (id: AnyNodeId, data: Record<string, unknown>) => void): number;
type Opening = (DoorNode | WindowNode) & {
    type: 'door' | 'window';
};
/**
 * Every door and window under the level, clockwise from the NW-most
 * exterior wall, exterior walls first.
 */
export declare function orderedOpenings(nodes: Readonly<Record<string, AnyNode>>, levelId: AnyNodeId): Opening[];
export {};
//# sourceMappingURL=marks.d.ts.map