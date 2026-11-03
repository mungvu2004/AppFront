import { describe, expect, it } from 'vitest';

import { CONFIDENCE_CERTAIN_THRESHOLD, CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';

import { SELECTION_SEPARATOR_FILTER, WALL_LOW_EDGE_CUT, isLowConfidence, wallConfidenceToken } from './materialMap';

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

describe('wallConfidenceToken', () => {
  it('gives each confidence tier its own token; reviewed stays the human green (A5)', () => {
    const tokens = (['certain', 'suggested', 'needsReview', 'reviewed'] as const).map(wallConfidenceToken);

    expect(new Set(tokens).size).toBe(4);
    expect(tokens).toEqual(['var(--wall-conf-high)', 'var(--wall-conf-mid)', 'var(--wall-conf-low)', 'var(--state-verified)']);
  });
});

/* Bảng "Chì và nâu đất": mép khắc + viền tách đều là màu nền canvas, không phải một màu bậc mới. */
describe('WALL_LOW_EDGE_CUT / SELECTION_SEPARATOR_FILTER', () => {
  it('mép khắc: nét 2 px màu nền, gạch 1 cách 4, không co giãn theo phóng', () => {
    expect(WALL_LOW_EDGE_CUT).toEqual({
      stroke: 'var(--wall-conf-cut)',
      strokeWidth: 2,
      strokeDasharray: '1 4',
      strokeLinecap: 'butt',
      strokeLinejoin: 'round',
      vectorEffect: 'non-scaling-stroke',
    });
  });

  it('viền tách quanh viền chọn: bốn bóng sắc 1 px màu nền', () => {
    expect(SELECTION_SEPARATOR_FILTER.match(/drop-shadow\([^)]*var\(--wall-conf-cut\)\)/g)).toHaveLength(4);
    expect(SELECTION_SEPARATOR_FILTER).not.toMatch(/ [1-9]px var/); // bán kính nhoè luôn 0
  });
});
