import { describe, expect, it } from 'vitest';

import { BYTE_UNITS, BYTES_PER_UNIT, formatFileSize } from '../bytes';
import { MISSING_VALUE } from '../number';

describe('formatFileSize', () => {
  it('keeps a size under a kilobyte whole, in bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1.023 B');
  });

  it('steps up a unit at each power of 1024', () => {
    expect(formatFileSize(BYTES_PER_UNIT)).toBe('1,0 KB');
    expect(formatFileSize(BYTES_PER_UNIT ** 2)).toBe('1,0 MB');
    expect(formatFileSize(BYTES_PER_UNIT ** 3)).toBe('1,0 GB');
    expect(formatFileSize(BYTES_PER_UNIT ** 4)).toBe('1,0 TB');
  });

  it('stays on the largest unit rather than inventing one', () => {
    expect(formatFileSize(BYTES_PER_UNIT ** 5)).toBe('1.024,0 TB');
    expect(BYTE_UNITS[BYTE_UNITS.length - 1]).toBe('TB');
  });

  it('writes the decimal mark as a comma — invariant A15', () => {
    const written = formatFileSize(1_572_864);

    expect(written).toBe('1,5 MB');
    expect(written).not.toContain('.');
  });

  it('groups thousands with a dot, the mirror of English', () => {
    expect(formatFileSize(1_073_741_824, { unit: 'KB' })).toBe('1.048.576,0 KB');
  });

  it('agrees with the numbers the upload limits are written in', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5,0 MB');
    expect(formatFileSize(100 * 1024 * 1024)).toBe('100,0 MB');
  });

  it('keeps a column in one unit when asked', () => {
    expect(formatFileSize(512, { unit: 'KB' })).toBe('0,5 KB');
    expect(formatFileSize(5 * 1024 * 1024, { unit: 'B' })).toBe('5.242.880 B');
  });

  it('takes an override for the decimals', () => {
    expect(formatFileSize(1_572_864, { fractionDigits: 2 })).toBe('1,50 MB');
    expect(formatFileSize(1_572_864, { fractionDigits: 0 })).toBe('2 MB');
  });

  it('writes a negative size with its sign', () => {
    expect(formatFileSize(-2048)).toBe('-2,0 KB');
  });

  it.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'answers %s with the missing-value dash',
    (value) => {
      expect(formatFileSize(value)).toBe(MISSING_VALUE);
    },
  );
});
