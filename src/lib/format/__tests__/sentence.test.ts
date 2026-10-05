import { describe, expect, it } from 'vitest';
import { lowerFirst } from '../sentence';

describe('lowerFirst', () => {
  it('lower-cases only the first letter, Vietnamese capitals included', () => {
    expect(lowerFirst('Cửa đi')).toBe('cửa đi');
    expect(lowerFirst('Đơn vị đo')).toBe('đơn vị đo');
    expect(lowerFirst('Tầng AI')).toBe('tầng AI');
  });

  it('leaves an empty string alone', () => {
    expect(lowerFirst('')).toBe('');
  });
});
