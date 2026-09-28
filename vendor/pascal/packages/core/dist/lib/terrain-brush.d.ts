/**
 * The sculpt brush: pointer motion → `HeightPatch`.
 *
 * The obvious implementation — `h += strength * falloff` every tick — is wrong,
 * and it is wrong in a way that is well documented by the people who ship it.
 * Dwelling in one spot accumulates without bound, overlapping dabs double-apply,
 * and a fast drag deposits less material than a slow one. That is exactly the
 * "hash edges and jagged" result expert Sims builders complain about and route
 * around. This module implements the model the mature tools converge on instead:
 *
 * 1. **Freeze a snapshot at pointer-down.** Every dab is evaluated against the
 *    snapshot, never against the running result.
 * 2. **Saturating coverage mask.** A dab raises coverage to `max(mask, falloff)`
 *    rather than adding to it, and the height is always
 *    `snapshot + delta * mask`. Re-crossing your own stroke therefore cannot
 *    compound — the second pass recomputes the same value from the same
 *    snapshot.
 * 3. **Arc-length dab spacing.** `advanceStroke` walks from the previous dab to
 *    the new pointer position in fixed metre steps, so stroke strength is a
 *    function of distance travelled, not of mouse speed or frame rate.
 * 4. **Cosine-bell falloff.** Of the standard sculpt kernels this is one of only
 *    two that are C¹ at *both* centre and rim, which is what prevents a visible
 *    ridge at the brush boundary.
 *
 * The consequence users feel: one stroke is one bounded, repeatable edit. Hold
 * still and nothing runs away; press again to go further.
 *
 * The `TerrainStroke` returned by `beginStroke` is a mutable accumulator — the
 * one mutable thing in this file, and deliberately so. It is owned by exactly
 * one in-flight gesture and dies with it, which is cheaper and clearer than
 * rebuilding a coverage map per pointer-move.
 */
import { type HeightPatch, type TerrainField } from './terrain-field.js';
export type BrushShape = 'round' | 'square';
/**
 * `raise`/`lower` are one verb with an inverted sign at the call site, matching
 * every surveyed tool's modifier-inverts convention. `flatten` is absolute:
 * it converges on a target height, which is the operation that makes two
 * disjoint building pads provably equal — the thing freehand push/pull cannot do.
 */
export type TerrainVerb = 'raise' | 'lower' | 'flatten' | 'smooth';
export type BrushSettings = {
    /** Brush radius in metres. */
    radius: number;
    /** 0–1. Scales how far one full stroke pass gets toward its goal. */
    strength: number;
    /**
     * 0–1 softness. 0 is a hard-edged stamp; 1 puts the cosine bell across the
     * whole radius. The inner `1 - falloff` fraction stays at full coverage.
     */
    falloff: number;
    shape: BrushShape;
};
export declare const DEFAULT_BRUSH_SETTINGS: BrushSettings;
/**
 * Metres a single raise/lower stroke moves the ground at full strength and full
 * coverage. Bounding it per stroke is what makes the verb aimable: the user
 * knows a pass is worth at most this much, and repeats for more.
 */
export declare const RAISE_METRES_PER_STROKE = 1;
/**
 * Smallest brush radius that still bites, as a multiple of the field's spacing.
 *
 * A dab only moves samples that fall *inside* its radius, so a brush narrower
 * than the gap between samples can land entirely between four of them and change
 * nothing: `advanceStroke` returns `null`, and the user drags with no mark, no
 * cursor change, and no error. 1.5 rather than the ~0.71 where a round brush
 * first catches a corner, because a brush that only bites when it happens to
 * straddle a sample is worse than one that is honestly too small — at 1.5 the
 * worst-case coverage is 0.97, so the dab lands wherever it is aimed.
 *
 * A *multiple* of spacing rather than a constant because spacing is not fixed:
 * `fieldExtentForSite` stretches it once a lot exceeds what 257² samples cover
 * at the default, so on a 300 m lot the old flat 0.5 m floor sat below half the
 * sample gap and the brush silently stopped working at the bottom of its range.
 */
export declare const MIN_BRUSH_RADIUS_IN_SPACINGS = 1.5;
/**
 * Clamp a radius to what `field` can actually resolve.
 *
 * Lives here rather than in the editor's UI layer because it is a fact about the
 * footprint math above, not a preference: every producer of a radius (slider,
 * `[`/`]`, a future import preset) has to respect it or it produces a brush that
 * does nothing.
 */
export declare function minBrushRadius(field: Pick<TerrainField, 'spacing'>): number;
export type TerrainStroke = {
    readonly verb: TerrainVerb;
    readonly settings: BrushSettings;
    /** The field at pointer-down. Never mutated; every dab reads from it. */
    readonly snapshot: TerrainField;
    /** Absolute target height in metres. Only meaningful for `flatten`. */
    readonly target: number;
    /** Sample index → saturating coverage in 0–1. */
    readonly mask: Map<number, number>;
    /** Lazily computed diffused snapshot, for `smooth`. */
    smoothed: Int16Array | null;
    /** Last dab centre, for arc-length spacing. Null until the first dab. */
    lastX: number | null;
    lastZ: number | null;
};
export declare function beginStroke(options: {
    field: TerrainField;
    verb: TerrainVerb;
    settings?: Partial<BrushSettings>;
    /** Absolute height for `flatten`, in metres. Ignored by the other verbs. */
    target?: number;
}): TerrainStroke;
/**
 * Sample the height a `flatten` stroke should aim at, from the field itself.
 *
 * Sampling before the stroke starts (right-click / first click, per the surveyed
 * tools) is what makes "flatten this pad to match that corner" a two-step
 * gesture instead of a numeric-entry chore.
 */
export declare function sampleTarget(field: TerrainField, x: number, z: number): number;
/**
 * Forget where the last dab landed, without ending the stroke.
 *
 * Needed because dab spacing is a true *arc length*: `advanceStroke` interpolates
 * from the previous centre, so any gap in the pointer stream is bridged with a
 * line of dabs when it resumes. That is exactly right for a dropped frame, and
 * exactly wrong when the caller deliberately skipped a stretch — a camera zoom
 * mid-stroke moves the ground under a held brush, and bridging back to a centre
 * from before the zoom paints a stripe across everything in between.
 *
 * A stroke resumed after this deposits its next dab at the pointer, like the
 * first one. The mask is untouched, so the stroke stays saturating across the
 * break and the whole gesture is still one undo step.
 */
export declare function detachStrokeAnchor(stroke: TerrainStroke): void;
/**
 * Extend the stroke to the pointer's new position and return the patch to apply.
 *
 * Returns `null` when the motion is shorter than the dab spacing (nothing
 * changed yet) or when the footprint misses the field entirely. The patch is
 * absolute heights over the union of the dabs placed by *this* call, recomputed
 * from the snapshot and the saturated mask — which is why applying patches in
 * order converges rather than compounding.
 */
export declare function advanceStroke(stroke: TerrainStroke, x: number, z: number): HeightPatch | null;
/**
 * Coverage in 0–1 for a sample at offset `(dx, dz)` from a dab centre.
 *
 * Round uses Euclidean distance, square uses Chebyshev — the same radius means
 * the square brush's inscribed circle matches the round one, so switching shape
 * mid-session does not change the brush's apparent size.
 */
export declare function weightAt(settings: BrushSettings, dx: number, dz: number): number;
/**
 * The world-XZ height under a brush, for the readout the sculpt HUD shows.
 * Thin, but it keeps the tool from importing `heightAt` just to render a number.
 */
export declare function brushHeightAt(field: TerrainField, x: number, z: number): number;
/** Peak coverage the stroke reached, for tests and for the HUD's "pass" readout. */
export declare function maxCoverage(stroke: TerrainStroke): number;
/**
 * Highest sample height in metres under a world-XZ rect — the seed a `flatten`
 * pad uses when the user asks for "level with the high corner" rather than
 * typing a number.
 */
export declare function highestOver(field: TerrainField, minX: number, minZ: number, maxX: number, maxZ: number): number;
//# sourceMappingURL=terrain-brush.d.ts.map