import { describe, expect, it } from 'vitest';

import { isWithinThicknessTolerance, WALL_THICKNESS_TOLERANCE_MM } from '../thicknessTolerance';

describe('isWithinThicknessTolerance (R-3/R-7)', () => {
  it('116 mm nằm trong dung sai của 110 — không còn so bằng đúng', () => {
    expect(isWithinThicknessTolerance(116, [110, 220, 330])).toBe(true);
  });

  it('tính cả biên, ngoài biên là lệch', () => {
    expect(isWithinThicknessTolerance(110 + WALL_THICKNESS_TOLERANCE_MM, [110])).toBe(true);
    expect(isWithinThicknessTolerance(110 + WALL_THICKNESS_TOLERANCE_MM + 1, [110])).toBe(false);
    expect(isWithinThicknessTolerance(185, [110, 220, 330])).toBe(false);
  });
});
