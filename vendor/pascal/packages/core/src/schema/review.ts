import { z } from 'zod'

/**
 * Review state of a node: how much its geometry is trusted, who authored it,
 * and whether a human reviewer has signed it off.
 *
 * The field is nested under `review`, not spread as three top-level fields,
 * for the reason `provenance.ts` already records: a hosted third-party plugin
 * declares its own top-level `source` (`articraft:asset`), and a top-level
 * `source` on `BaseNode` would collide with it. Nested, `review.source` can
 * never be confused with a plugin's own field, and `provenance.test.ts`'s
 * "a plugin field named `source` does not collide" keeps holding.
 *
 * `reviewed` is the sign-off of a *person*. A generated node never carries
 * `reviewed: true` — the flag means "a reviewer looked at this", so a writer
 * that sets it from a model's output is lying about who checked the geometry.
 * Every tool that changes a node's geometry clears it back to `false`: the
 * sign-off was about the shape that is now gone.
 *
 * All three fields are optional and carry no `.default()`. The runtime path
 * loads scenes with `setScene`, which does not parse through zod (NGUON.md
 * §2), so a default here would never be applied and reading code would still
 * have to handle `undefined`. One absent-means-unknown contract is simpler
 * than a default that only half the writers get.
 */

/** Who produced the node's geometry. */
export const ReviewSource = z.enum(['ai', 'human'])
export type ReviewSource = z.infer<typeof ReviewSource>

export const Review = z.object({
  /**
   * A human reviewer has signed this node off. Only a person's action sets
   * it; a geometry edit clears it.
   */
  reviewed: z.boolean().optional(),
  /** How much the producer trusts the geometry, `0`–`1` inclusive. */
  confidence: z.number().min(0).max(1).optional(),
  /** Whether the geometry came from a model or from a person. */
  source: ReviewSource.optional(),
})
export type Review = z.infer<typeof Review>

/** Below this a model's own score is "unsure", and the node asks for a look. */
export const SUSPECT_CONFIDENCE = 0.6

/**
 * The three review states (A4) — every panel colours a node by this and
 * nothing else, so the inspector and the room-area table cannot disagree.
 * Only `reviewed: true` reaches `'reviewed'` (A5): no score, however high,
 * stands in for a person's sign-off.
 */
export type ReviewState = 'reviewed' | 'suspect' | 'trusted'

export const reviewStateOf = (review: Review | undefined): ReviewState => {
  if (review?.reviewed === true) return 'reviewed'
  const confidence = review?.confidence
  return typeof confidence === 'number' && confidence < SUSPECT_CONFIDENCE ? 'suspect' : 'trusted'
}
