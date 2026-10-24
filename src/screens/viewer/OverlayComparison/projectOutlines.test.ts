import { describe, expect, it } from 'vitest';

import { projectOutlines } from './useOverlayComparison';

// BUG-IT-005: G1 (654x1246 px, 1 mm/px). Model walls span x 0..637, y 218..1136 mm.
const outlines = [
  { id: 'W-a', isClosed: false, points: [{ x: 0, y: 220 }, { x: 132, y: 220 }] },
  { id: 'W-b', isClosed: false, points: [{ x: 637, y: 218 }, { x: 637, y: 1136 }] },
];

describe('projectOutlines', () => {
  it('places walls in the scan frame when image size and scale are known', () => {
    const [a, b] = projectOutlines(outlines, { widthMm: 654, heightMm: 1246 });

    expect(a?.points[1]?.x).toBeCloseTo(132 / 654);
    expect(a?.points[0]?.y).toBeCloseTo(220 / 1246);
    expect(b?.points[0]?.x).toBeCloseTo(637 / 654);
    expect(b?.points[1]?.y).toBeCloseTo(1136 / 1246);
  });

  it('scales mm back to image pixels with the level scale', () => {
    const [a] = projectOutlines(
      [{ id: 'W', isClosed: false, points: [{ x: 1200, y: 0 }, { x: 2400, y: 600 }] }],
      { widthMm: 4800, heightMm: 2400 },
    );

    expect(a?.points[0]?.x).toBeCloseTo(0.25);
    expect(a?.points[1]?.y).toBeCloseTo(0.25);
  });

  it('falls back to the model bounding box without a scan frame', () => {
    const [a, b] = projectOutlines(outlines, null);

    expect(a?.points[0]).toEqual({ x: 0, y: (220 - 218) / 918 });
    expect(b?.points[1]).toEqual({ x: 1, y: 1 });
  });
});
