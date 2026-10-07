import type { HeightPatch, TerrainField } from '../lib/terrain-field.js';
/**
 * In-progress terrain edits, held as a live `TerrainField` rather than as node
 * data.
 *
 * This is the sculpting analogue of `useLiveNodeOverrides`, and it exists because
 * that store cannot be reused here. An override stores *node* values, so a live
 * terrain override would have to be a `TerrainData` — meaning every dab of a
 * brush would base64-encode the whole field, ~11 KB at 65² and ~44 KB at 129²,
 * dozens of times a second. Holding the decoded field instead makes a dab cost
 * one `applyHeightPatch` (a typed-array copy) and nothing else.
 *
 * The store also carries the **stroke's starting field**, which is what makes the
 * saturating stroke model possible: a brush computes `snapshot + delta · mask`
 * rather than accumulating onto the current field, so re-crossing your own stroke
 * cannot compound. Without a snapshot the same drag deposits material twice
 * wherever it overlaps itself, which is the single most common way a sculpt tool
 * feels wrong.
 *
 * `lastPatch` is how the renderer knows what to upload: it takes the patch,
 * pushes exactly those rows, and never diffs the whole field.
 */
export type LiveTerrainStroke = {
    /** The field as it was at pointer-down. Never mutated during the stroke. */
    readonly snapshot: TerrainField;
    /** The field as of the most recent dab — what the renderer and readers see. */
    readonly field: TerrainField;
    /**
     * The most recent dab's patch, or null right after `begin`. The renderer
     * consumes this for the dirty-rect upload; a null means "nothing new to push".
     */
    readonly lastPatch: HeightPatch | null;
};
export type RemoteLiveTerrainStroke = {
    readonly sourceId: string;
    readonly field: TerrainField;
    readonly lastPatch: HeightPatch;
};
type LiveTerrainState = {
    /** Keyed by site node id — a scene can hold more than one site. */
    strokes: Map<string, LiveTerrainStroke>;
    remoteStrokes: Map<string, RemoteLiveTerrainStroke>;
    /**
     * Start a stroke from `field`.
     *
     * A second `begin` for the same site *replaces* the stroke rather than being
     * rejected — and that is a hazard, not idempotence, which is why it is spelled
     * out here: the caller passes the field it is currently reading, and mid-stroke
     * that field is the live one, dabs included. So a re-begin adopts uncommitted
     * dabs as the new stroke's snapshot, where they become the saturating baseline
     * and get persisted by the next commit — visible on screen the whole time, yet
     * absent from history and unreachable by undo.
     *
     * `advance` takes the opposite stance for the same reason (a dab with no stroke
     * is ignored rather than inventing a snapshot): the invariant is that a snapshot
     * only ever comes from a deliberate stroke boundary. Callers own the boundary —
     * `end` first, or don't begin.
     */
    begin(siteId: string, field: TerrainField): void;
    /** Record a dab. `field` must be the result of applying `patch`. */
    advance(siteId: string, field: TerrainField, patch: HeightPatch): void;
    /** The live field for a site, or undefined when no stroke is in flight. */
    fieldOf(siteId: string): TerrainField | undefined;
    strokeOf(siteId: string): LiveTerrainStroke | undefined;
    remoteStrokeOf(siteId: string): RemoteLiveTerrainStroke | undefined;
    previewRemote(siteId: string, sourceId: string, field: TerrainField, patch: HeightPatch): void;
    endRemote(siteId: string, sourceId: string): void;
    endRemoteSource(sourceId: string): void;
    /** End the stroke. The caller persists the field first if it wants to keep it. */
    end(siteId: string): void;
    endAll(): void;
};
declare const useLiveTerrain: import("zustand").UseBoundStore<import("zustand").StoreApi<LiveTerrainState>>;
export default useLiveTerrain;
//# sourceMappingURL=use-live-terrain.d.ts.map