import { describe, expect, it } from 'vitest';

import { formatLength } from '../measure';

describe('format/measure.ts — formatLength cm', () => {
  it('writes the three contract examples verbatim', () => {
    expect(formatLength(3450, { unit: 'mm' })).toBe('3.450 mm');
    expect(formatLength(3450, { unit: 'cm' })).toBe('345,0 cm');
    expect(formatLength(3450, { unit: 'm' })).toBe('3,45 m');
  });

  it('lets fractionDigits override the default one decimal for cm', () => {
    expect(formatLength(3450, { unit: 'cm', fractionDigits: 0 })).toBe('345 cm');
    expect(formatLength(3450, { unit: 'cm', fractionDigits: 3 })).toBe('345,000 cm');
  });

  it('writes zero in cm', () => {
    expect(formatLength(0, { unit: 'cm' })).toBe('0,0 cm');
  });

  it('writes a negative length in cm', () => {
    expect(formatLength(-3450, { unit: 'cm' })).toBe('-345,0 cm');
  });

  it('never chooses cm automatically, regardless of magnitude', () => {
    const magnitudes = [0, 1, 220, 850, 999, 1000, 3450, 12400, -3450, 1_000_000];
    for (const valueMm of magnitudes) {
      expect(formatLength(valueMm)).not.toMatch(/ cm$/u);
    }
  });
});
