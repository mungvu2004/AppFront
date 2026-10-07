import type { AnyNode, AnyNodeId } from '@pascal-app/core';
/**
 * Tag + rewind bookkeeping for auto-routed vertical offsets.
 *
 * When a connected duct run is lifted with the run-center ±Y arrows, the
 * planner welds it back to its stationary partner with an auto-routed Z/S
 * offset — elbows + a plumb riser (see `vertical-offset.ts`). On commit we
 * stamp the LIFTED RUN with an `autoOffset` tag in its `metadata` recording:
 *   - the minted nodes (elbows + risers) that formed the offset, and
 *   - the `base` patches that restore the run + its partners to the LOGICAL L
 *     they sprang from (the canonical corner, before any offset).
 *
 * That tag lets a LATER drag dissolve the offset and replan from the clean L:
 * at drag start we rewind (delete the minted nodes, apply the base patches),
 * plan a fresh offset from the logical L, and commit the result — so dragging
 * back toward the original height collapses the Z back to an L, and re-lifting
 * forms a new one. The `base` moves when the whole tagged offset is translated
 * and is refreshed when fitting edits retarget its collars; otherwise a later
 * re-drag would rewind to stale geometry.
 *
 * The tag lives only on the run (detection keys off the dragged run), not on
 * the minted fittings / risers.
 */
/** Key under a node's `metadata` JSON bag where the offset tag is stored. */
export declare const AUTO_OFFSET_KEY = "autoOffset";
/** A logical-L restore patch: a node id plus the field subset that returns it
 *  to its pre-offset pose (a run's `path`, or a fitting's `position` /
 *  `rotation` / `angle`). */
export type AutoOffsetBasePatch = {
    id: AnyNodeId;
    data: Record<string, unknown>;
};
export type AutoOffsetTag = {
    /** Stable id shared by every node in this offset (currently only the run
     *  carries the tag, but the group id lets future selections relate them). */
    group: string;
    /** The vertical lift (meters, signed) from the logical L that formed this
     *  offset. A re-drag plans from the L with `dy + delta`, so grabbing the run
     *  with no movement reproduces this exact Z, and dragging it down by `dy`
     *  lands back on the L. Invariant inputs (L + dy) make the re-plan match the
     *  committed geometry. */
    dy: number;
    /** The elbows + risers minted to form this offset — deleted on rewind. */
    minted: AnyNodeId[];
    /** Patches restoring the run + partners to the current logical L. */
    base: AutoOffsetBasePatch[];
};
type Point = [number, number, number];
/** The offset tag on `node`, or null if it carries none / a malformed one. */
export declare function readAutoOffsetTag(node: {
    metadata?: unknown;
} | null | undefined): AutoOffsetTag | null;
/** `metadata` with the offset tag set (replacing any prior one). */
export declare function withAutoOffsetTag(metadata: unknown, tag: AutoOffsetTag): Record<string, unknown>;
/** `metadata` with the offset tag removed — the run is a clean L again. */
export declare function withoutAutoOffsetTag(metadata: unknown): Record<string, unknown>;
/** Translate the logical-L base when the whole tagged offset is moved rigidly. */
export declare function translateAutoOffsetBase(tag: AutoOffsetTag, delta: Point): AutoOffsetTag;
/** Scene updates that drop auto-offset ownership when a participating part is edited manually. */
export declare function autoOffsetInvalidationUpdates(nodes: Record<string, AnyNode>, editedNodeId: AnyNodeId): {
    id: AnyNodeId;
    data: Partial<AnyNode>;
}[];
/** A fresh, scene-unique-enough group id for a newly minted offset. */
export declare function newAutoOffsetGroupId(): string;
export {};
//# sourceMappingURL=auto-offset-tag.d.ts.map