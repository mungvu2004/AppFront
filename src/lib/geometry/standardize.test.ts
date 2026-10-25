import { describe, it, expect } from 'vitest';
import { standardizeThickness } from './standardize';

describe('standardize.ts', () => {
  it('standardizes to 110mm', () => {
    expect(standardizeThickness(100).standardized).toBe(110);
    expect(standardizeThickness(165).standardized).toBe(110); // 80–165 → 110
  });

  it('standardizes to 220mm', () => {
    expect(standardizeThickness(166).standardized).toBe(220); // exactly at threshold
    expect(standardizeThickness(200).standardized).toBe(220);
    expect(standardizeThickness(275).standardized).toBe(220);
  });

  it('standardizes to 330mm', () => {
    expect(standardizeThickness(276).standardized).toBe(330); // exactly at threshold
    expect(standardizeThickness(300).standardized).toBe(330);
    expect(standardizeThickness(399).standardized).toBe(330);
  });

  it('standardizes to CONCRETE_COLUMN', () => {
    expect(standardizeThickness(400).standardized).toBe('CONCRETE_COLUMN');
    expect(standardizeThickness(500).standardized).toBe('CONCRETE_COLUMN');
  });

  it('returns original value', () => {
    expect(standardizeThickness(200).original_mm).toBe(200);
  });
});
