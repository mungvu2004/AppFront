import { describe, expect, it } from 'vitest';

import { roomLabelFit } from './room-label-fit';

const square = (size: number) =>
  [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ] as const;
const label = { rotationDeg: 0, nameChars: 10, detailChars: 16, lines: 2 };

describe('roomLabelFit', () => {
  it('shows name and detail while the room is wide enough on screen', () => {
    // 4 m room, 100 px/m: 400 px wide.
    expect(roomLabelFit({ ...label, polygon: square(4), at: [2, 2], unitsPerPixel: 0.01 })).toBe('full');
  });

  it('drops the detail first, then the whole label, as the plan zooms out', () => {
    // 90 px: the 76 px name fits, the 99 px detail does not.
    expect(roomLabelFit({ ...label, polygon: square(4), at: [2, 2], unitsPerPixel: 4 / 90 })).toBe('name');
    // 60 px: not even the name.
    expect(roomLabelFit({ ...label, polygon: square(4), at: [2, 2], unitsPerPixel: 4 / 60 })).toBe('none');
  });

  it('measures through the label, so an off-centre label has less room', () => {
    expect(roomLabelFit({ ...label, polygon: square(4), at: [0.2, 2], unitsPerPixel: 0.01 })).toBe('none');
  });

  it('reads the screen directions of a rotated plan: a corridor across the screen keeps its name', () => {
    const corridor = [
      [0, 0],
      [1, 0],
      [1, 8],
      [0, 8],
    ] as const;
    const wide = { ...label, polygon: corridor, at: [0.5, 4] as const, unitsPerPixel: 0.02 };
    expect(roomLabelFit(wide)).toBe('none');
    expect(roomLabelFit({ ...wide, rotationDeg: 90 })).toBe('full');
  });

  it('a short room holds one line only', () => {
    const low = [
      [0, 0],
      [6, 0],
      [6, 0.5],
      [0, 0.5],
    ] as const;
    expect(roomLabelFit({ ...label, polygon: low, at: [3, 0.25], unitsPerPixel: 0.02 })).toBe('name');
  });
});
