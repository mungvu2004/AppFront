import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { BaseNode } from './base'
import { Review, reviewStateOf, withReviewCleared } from './review'

const issuePaths = (value: unknown): string[] => {
  const result = Review.safeParse(value)
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
}

describe('review state on every node', () => {
  test('all three fields are optional and absent stays absent', () => {
    expect(Review.parse({})).toEqual({})
    const node = BaseNode.parse({ id: 'wall_1' })
    expect(node.review).toBeUndefined()
  })

  test('a full record round-trips verbatim', () => {
    const review = { reviewed: true, confidence: 0.42, source: 'human' as const }
    expect(BaseNode.parse({ id: 'wall_1', review }).review).toEqual(review)
  })

  test('confidence is bounded to 0-1 and refuses outside it', () => {
    expect(issuePaths({ confidence: 0 })).toEqual([])
    expect(issuePaths({ confidence: 1 })).toEqual([])
    expect(issuePaths({ confidence: -0.01 })).toEqual(['confidence'])
    expect(issuePaths({ confidence: 1.01 })).toEqual(['confidence'])
  })

  test('source accepts only ai or human', () => {
    expect(issuePaths({ source: 'ai' })).toEqual([])
    expect(issuePaths({ source: 'human' })).toEqual([])
    expect(issuePaths({ source: 'robot' })).toEqual(['source'])
  })

  // The reason `review.source` is nested rather than a top-level BaseNode
  // field: a hosted plugin declares its own `source` (see provenance.ts).
  test('a plugin field named `source` still does not collide', () => {
    const PluginNode = BaseNode.extend({ source: z.enum(['articraft-10k', 'generated']) })
    const parsed = PluginNode.parse({
      id: 'asset_1',
      source: 'generated',
      review: { source: 'ai', confidence: 0.5 },
    })
    expect(parsed.source).toBe('generated')
    expect(parsed.review).toEqual({ source: 'ai', confidence: 0.5 })
  })
})

describe('reviewStateOf — the three states (A4/A5)', () => {
  test('only a person sign-off reaches reviewed, whatever the score', () => {
    expect(reviewStateOf({ reviewed: true, source: 'ai', confidence: 0.1 })).toBe('reviewed')
    expect(reviewStateOf({ source: 'ai', confidence: 1 })).toBe('trusted')
  })

  test('a low score is suspect, absent review is trusted', () => {
    expect(reviewStateOf({ confidence: 0.59 })).toBe('suspect')
    expect(reviewStateOf({ confidence: 0.6 })).toBe('trusted')
    expect(reviewStateOf(undefined)).toBe('trusted')
  })
})

describe('withReviewCleared — a geometry edit voids the sign-off', () => {
  const reviewed = { review: { reviewed: true, source: 'ai' as const } }

  test('geometry patch on a reviewed node clears reviewed, keeps source', () => {
    expect(withReviewCleared(reviewed, { thickness: 0.3 } as { review?: Review })).toEqual({
      thickness: 0.3,
      review: { reviewed: false, source: 'ai' },
    } as never)
  })

  test('rename, an explicit review patch, or an unreviewed node pass through', () => {
    const rename = { name: 'Tường A' } as { review?: Review }
    expect(withReviewCleared(reviewed, rename)).toBe(rename)
    const approve = { review: { reviewed: true } }
    expect(withReviewCleared({}, approve)).toBe(approve)
    const move = { position: [1, 0, 0] } as { review?: Review }
    expect(withReviewCleared({ review: { reviewed: false } }, move)).toBe(move)
  })
})
