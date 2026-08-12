import { describe, it, expect } from 'vitest';
import { useGridLayer } from './useGridLayer';

// Hook thuần — không cần DOM, test trực tiếp giá trị trả về

describe('useGridLayer', () => {
  const scaleRatio = 12; // 12 mm/px

  it('calculates minorStepPx at zoom 1', () => {
    const result = useGridLayer(1, scaleRatio);
    // 100mm / 12mm/px * 1 = 8.33px
    expect(result.minorStepPx).toBeCloseTo(100 / 12, 2);
    expect(result.majorStepPx).toBeCloseTo(1000 / 12, 2);
  });

  it('calculates steps from scaleRatio', () => {
    const result = useGridLayer(1, 10);
    expect(result.minorStepPx).toBeCloseTo(10, 2);
    expect(result.majorStepPx).toBeCloseTo(100, 2);
  });

  it('showMinorGrid = true khi zoom >= 0.4', () => {
    expect(useGridLayer(0.4, scaleRatio).showMinorGrid).toBe(true);
    expect(useGridLayer(1.0, scaleRatio).showMinorGrid).toBe(true);
  });

  it('showMinorGrid = false khi zoom < 0.4', () => {
    expect(useGridLayer(0.39, scaleRatio).showMinorGrid).toBe(false);
    expect(useGridLayer(0.1, scaleRatio).showMinorGrid).toBe(false);
  });

  it('returns 0 when scaleRatio is 0', () => {
    const result = useGridLayer(1, 0);
    expect(result.minorStepPx).toBe(0);
    expect(result.majorStepPx).toBe(0);
  });

  it('override config minorStepMm', () => {
    const result = useGridLayer(1, 10, { minorStepMm: 50 });
    expect(result.minorStepPx).toBeCloseTo(5, 2);
  });

  it('override minorHideZoomThreshold', () => {
    const result = useGridLayer(0.3, scaleRatio, { minorHideZoomThreshold: 0.2 });
    expect(result.showMinorGrid).toBe(true);
  });
});
