import { describe, expect, it } from 'vitest';

import {
  classifyContrast,
  classifyMetric,
  classifyNoise,
  classifyResolution,
  classifySkew,
  worstLevel,
  CONTRAST_ATTENTION_SCORE,
  CONTRAST_GOOD_SCORE,
  NOISE_ATTENTION_SCORE,
  NOISE_GOOD_SCORE,
  RESOLUTION_ATTENTION_SHORT_EDGE_PX,
  RESOLUTION_GOOD_SHORT_EDGE_PX,
  SKEW_ATTENTION_DEG,
  SKEW_GOOD_DEG,
  type ImageQualityLevel,
  type ImageQualityMetricId,
} from '../thresholds';

/**
 * Con số đặc tả nêu đích danh, giữ ở một chỗ.
 *
 * Ba trong bốn nhóm ngưỡng có một ví dụ đặc tả đã phán quyết sẵn — 2.000 px là
 * nên dùng, 1.240 x 900 px là kém, 0,2 độ là đạt, 3,4 độ là cần nắn. Đó là bốn
 * phép kiểm không được hỏng dù ai chỉnh hằng số thế nào, nên chúng đứng riêng
 * khỏi phần kiểm biên bên dưới.
 */
const SPEC_EXAMPLES = {
  poorImageShortEdgePx: 900,
  poorImageWidthPx: 1240,
  passingSkewDeg: 0.2,
  straightenableSkewDeg: 3.4,
} as const;

describe('ví dụ đặc tả nêu đích danh', () => {
  it('xếp ảnh 1.240 x 900 px vào mức kém, theo cạnh ngắn 900 px', () => {
    const shortEdgePx = Math.min(SPEC_EXAMPLES.poorImageWidthPx, SPEC_EXAMPLES.poorImageShortEdgePx);

    expect(shortEdgePx).toBe(SPEC_EXAMPLES.poorImageShortEdgePx);
    expect(classifyResolution(shortEdgePx)).toBe('poor');
  });

  it('xếp ảnh từ 2.000 px trở lên vào mức tốt', () => {
    expect(classifyResolution(2000)).toBe('good');
    expect(classifyResolution(3200)).toBe('good');
  });

  it('xếp nghiêng 0,2 độ là đạt và 3,4 độ là cần nắn', () => {
    expect(classifySkew(SPEC_EXAMPLES.passingSkewDeg)).toBe('good');
    expect(classifySkew(SPEC_EXAMPLES.straightenableSkewDeg)).toBe('attention');
  });
});

describe('classifyResolution', () => {
  it('trả tốt tại đúng ngưỡng tốt', () => {
    expect(classifyResolution(RESOLUTION_GOOD_SHORT_EDGE_PX)).toBe('good');
  });

  it('trả cần chú ý ngay dưới ngưỡng tốt', () => {
    expect(classifyResolution(RESOLUTION_GOOD_SHORT_EDGE_PX - 1)).toBe('attention');
  });

  it('trả cần chú ý tại đúng ngưỡng cần chú ý', () => {
    expect(classifyResolution(RESOLUTION_ATTENTION_SHORT_EDGE_PX)).toBe('attention');
  });

  it('trả kém ngay dưới ngưỡng cần chú ý', () => {
    expect(classifyResolution(RESOLUTION_ATTENTION_SHORT_EDGE_PX - 1)).toBe('poor');
  });

  it('trả kém cho ảnh rỗng', () => {
    expect(classifyResolution(0)).toBe('poor');
  });
});

describe('classifySkew', () => {
  it('trả tốt tại đúng ngưỡng tốt', () => {
    expect(classifySkew(SKEW_GOOD_DEG)).toBe('good');
  });

  it('coi nghiêng âm và nghiêng dương như nhau', () => {
    expect(classifySkew(-SPEC_EXAMPLES.straightenableSkewDeg)).toBe(
      classifySkew(SPEC_EXAMPLES.straightenableSkewDeg),
    );
    expect(classifySkew(-SKEW_GOOD_DEG)).toBe('good');
    expect(classifySkew(-SKEW_ATTENTION_DEG)).toBe('poor');
  });

  it('trả kém tại đúng ngưỡng mất trục', () => {
    expect(classifySkew(SKEW_ATTENTION_DEG)).toBe('poor');
  });

  it('trả cần chú ý ngay dưới ngưỡng mất trục', () => {
    expect(classifySkew(SKEW_ATTENTION_DEG - 0.1)).toBe('attention');
  });

  it('trả tốt cho ảnh thẳng tuyệt đối', () => {
    expect(classifySkew(0)).toBe('good');
  });
});

describe('classifyContrast', () => {
  it('trả tốt tại đúng ngưỡng tốt', () => {
    expect(classifyContrast(CONTRAST_GOOD_SCORE)).toBe('good');
  });

  it('trả cần chú ý ngay dưới ngưỡng tốt', () => {
    expect(classifyContrast(CONTRAST_GOOD_SCORE - 0.01)).toBe('attention');
  });

  it('trả cần chú ý tại đúng ngưỡng cần chú ý', () => {
    expect(classifyContrast(CONTRAST_ATTENTION_SCORE)).toBe('attention');
  });

  it('trả kém ngay dưới ngưỡng cần chú ý', () => {
    expect(classifyContrast(CONTRAST_ATTENTION_SCORE - 0.01)).toBe('poor');
  });

  it('trả tốt ở đầu trên của thang và kém ở đầu dưới', () => {
    expect(classifyContrast(1)).toBe('good');
    expect(classifyContrast(0)).toBe('poor');
  });
});

describe('classifyNoise', () => {
  it('trả tốt tại đúng ngưỡng tốt — thang này chạy ngược', () => {
    expect(classifyNoise(NOISE_GOOD_SCORE)).toBe('good');
  });

  it('trả cần chú ý ngay trên ngưỡng tốt', () => {
    expect(classifyNoise(NOISE_GOOD_SCORE + 0.01)).toBe('attention');
  });

  it('trả cần chú ý tại đúng ngưỡng cần chú ý', () => {
    expect(classifyNoise(NOISE_ATTENTION_SCORE)).toBe('attention');
  });

  it('trả kém ngay trên ngưỡng cần chú ý', () => {
    expect(classifyNoise(NOISE_ATTENTION_SCORE + 0.01)).toBe('poor');
  });

  it('trả tốt ở đầu dưới của thang và kém ở đầu trên', () => {
    expect(classifyNoise(0)).toBe('good');
    expect(classifyNoise(1)).toBe('poor');
  });
});

describe('classifyMetric', () => {
  const cases = [
    { expected: 'poor', id: 'resolution', value: 900 },
    { expected: 'attention', id: 'skew', value: 3.4 },
    { expected: 'good', id: 'contrast', value: 0.9 },
    { expected: 'good', id: 'noise', value: 0.1 },
  ] as const satisfies readonly { expected: ImageQualityLevel; id: ImageQualityMetricId; value: number }[];

  it.each(cases)('tra đúng hàm phân loại cho $id', ({ expected, id, value }) => {
    expect(classifyMetric(id, value)).toBe(expected);
  });

  it('cho cùng kết quả với hàm phân loại tương ứng', () => {
    expect(classifyMetric('resolution', 1500)).toBe(classifyResolution(1500));
    expect(classifyMetric('skew', 6)).toBe(classifySkew(6));
    expect(classifyMetric('contrast', 0.5)).toBe(classifyContrast(0.5));
    expect(classifyMetric('noise', 0.5)).toBe(classifyNoise(0.5));
  });
});

describe('worstLevel', () => {
  it('trả tốt cho danh sách rỗng', () => {
    expect(worstLevel([])).toBe('good');
  });

  it('giữ tốt khi mọi mức đều tốt', () => {
    expect(worstLevel(['good', 'good', 'good'])).toBe('good');
  });

  it('nhấc lên cần chú ý khi có một mức cần chú ý', () => {
    expect(worstLevel(['good', 'attention', 'good'])).toBe('attention');
  });

  it('nhấc lên kém khi có một mức kém, bất kể thứ tự', () => {
    expect(worstLevel(['poor', 'attention', 'good'])).toBe('poor');
    expect(worstLevel(['good', 'attention', 'poor'])).toBe('poor');
  });

  it('trả đúng mức đó khi danh sách chỉ có một phần tử', () => {
    expect(worstLevel(['attention'])).toBe('attention');
  });
});
