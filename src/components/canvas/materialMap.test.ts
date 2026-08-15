import { describe, expect, it } from 'vitest';

import { CONFIDENCE_CERTAIN_THRESHOLD, CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';

import { isLowConfidence } from './materialMap';

describe('isLowConfidence', () => {
  it('hatches only below the "cần kiểm tra" boundary', () => {
    expect(isLowConfidence(0.69)).toBe(true);
    expect(isLowConfidence(CONFIDENCE_SUGGESTED_THRESHOLD)).toBe(false);
  });

  /**
   * The regression this file exists for. The canvas used to hatch below its own
   * 0.75, a number sitting inside the 0,70–0,90 band the interface labels "AI đề
   * xuất": 0,72 came out hatched and 0,78 clean, though a reader is told the
   * same thing about both.
   */
  it('draws the whole "AI đề xuất" band the same way', () => {
    for (const confidence of [0.7, 0.72, 0.75, 0.78, 0.85, 0.89]) {
      expect(isLowConfidence(confidence)).toBe(false);
    }
  });

  it('leaves an AI-certain element clean', () => {
    expect(isLowConfidence(CONFIDENCE_CERTAIN_THRESHOLD)).toBe(false);
    expect(isLowConfidence(1)).toBe(false);
  });

  it('hatches an element the model had little faith in', () => {
    for (const confidence of [0, 0.1, 0.42, 0.62]) {
      expect(isLowConfidence(confidence)).toBe(true);
    }
  });

  /**
   * "No score yet" is not "a low score": a wall the pipeline never rated should
   * not be marked as doubted. The dash the rest of the interface shows for a
   * missing reading is the honest answer, and the canvas stays plain.
   */
  it('does not hatch an element with no usable score', () => {
    for (const confidence of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isLowConfidence(confidence)).toBe(false);
    }
  });
});
