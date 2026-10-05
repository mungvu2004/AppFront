import { describe, expect, it } from 'vitest';

import { graphVersionOf } from '../graphVersion';

describe('graphVersionOf', () => {
  it('does not depend on key order', () => {
    expect(graphVersionOf({ 'L-a': { revision: 1 }, 'L-b': { revision: 2 } })).toBe(
      graphVersionOf({ 'L-b': { revision: 2 }, 'L-a': { revision: 1 } }),
    );
  });

  it('changes when a revision changes', () => {
    expect(graphVersionOf({ 'L-a': { revision: 1 } })).not.toBe(graphVersionOf({ 'L-a': { revision: 2 } }));
  });

  it('is 16 lowercase hex characters', () => {
    expect(graphVersionOf({ 'L-a': { revision: 1 } })).toMatch(/^[0-9a-f]{16}$/u);
    expect(graphVersionOf({})).toMatch(/^[0-9a-f]{16}$/u);
  });

  it('sorts by code unit (L-B before L-a), not by locale', () => {
    // Pinned: hash of "L-B:2\nL-a:1"; a localeCompare sort would hash "L-a:1\nL-B:2" (79bc…).
    const expected = graphVersionOf({ 'L-B': { revision: 2 }, 'L-a': { revision: 1 } });

    expect(graphVersionOf({ 'L-a': { revision: 1 }, 'L-B': { revision: 2 } })).toBe(expected);
    expect(expected).toBe('b399fb31ab2966d3');
    expect(expected).not.toBe('79bcfaf96965144b');
  });

  it('gives the empty meta a fixed value, distinct from any floor', () => {
    expect(graphVersionOf({})).toBe(graphVersionOf({}));
    expect(graphVersionOf({})).not.toBe(graphVersionOf({ 'L-a': { revision: 0 } }));
  });
});
