import { describe, expect, it } from 'vitest';

import { PROVISIONAL_MEASURE_TEXT, measureTextOf, provisionalScaleNoticeOf } from '../provisionalScale';

describe('provisionalScale', () => {
  it('swaps the measure for the fixed text while the scale is provisional', () => {
    expect(measureTextOf('12,5 m', 'unresolved')).toBe(PROVISIONAL_MEASURE_TEXT);
    expect(PROVISIONAL_MEASURE_TEXT).toBe('Chưa có — tỉ lệ tạm');
  });

  it('keeps the measure when the scale is settled', () => {
    expect(measureTextOf('12,5 m', undefined)).toBe('12,5 m');
  });

  it('raises an attention notice only for a provisional scale', () => {
    expect(provisionalScaleNoticeOf('unresolved')).toEqual({
      level: 'attention',
      message: 'Tỉ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỉ lệ.',
    });
    expect(provisionalScaleNoticeOf(undefined)).toBeNull();
  });
});
