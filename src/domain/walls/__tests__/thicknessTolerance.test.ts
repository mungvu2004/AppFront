import { describe, expect, it } from 'vitest';

import {
  isWithinThicknessTolerance,
  roundWallThickness,
  WALL_THICKNESS_TOLERANCE_MM,
} from '../thicknessTolerance';

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

describe('roundWallThickness — luật làm tròn S-15/S-21', () => {
  it.each([
    [79, 'tooThin'],
    [80, 110],
    [165, 110],
    [166, 220],
    [275, 220],
    [276, 330],
    [399, 330],
    [400, 'tooThick'],
  ] as const)('%d mm → %s', (measuredMm, expected) => {
    expect(roundWallThickness(measuredMm)).toBe(expected);
  });

  it('hai đầu xem tay không bao giờ thành một độ dày chuẩn', () => {
    expect(roundWallThickness(26)).toBe('tooThin');
    expect(roundWallThickness(1014)).toBe('tooThick');
  });
});
