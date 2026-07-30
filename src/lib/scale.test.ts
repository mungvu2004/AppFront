import { describe, it, expect } from 'vitest';
import { computeScaleRatio, pxToMm, mmToPx } from './scale';

describe('scale.ts', () => {
  it('computes scale ratio correctly', () => {
    expect(computeScaleRatio(4800, 400)).toBe(12);
    expect(computeScaleRatio(1000, 100)).toBe(10);
    // Boundary/error case
    expect(computeScaleRatio(4800, 0)).toBe(0);
    expect(computeScaleRatio(4800, -10)).toBe(0);
  });

  it('converts px to mm', () => {
    expect(pxToMm(400, 12)).toBe(4800);
    expect(pxToMm(0, 12)).toBe(0);
  });

  it('converts mm to px', () => {
    expect(mmToPx(4800, 12)).toBe(400);
    expect(mmToPx(0, 12)).toBe(0);
    // Boundary/error case
    expect(mmToPx(4800, 0)).toBe(0);
    expect(mmToPx(4800, -5)).toBe(0);
  });
});
