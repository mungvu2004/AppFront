import { describe, it, expect } from 'vitest';
import { calculatePolygonArea, calculateLevelArea, formatAreaM2 } from './area';

describe('area.ts', () => {
  it('calculates polygon area correctly', () => {
    // 10x10 square -> 100 area
    const square = [
      { id: 'v1', x: 0, y: 0 },
      { id: 'v2', x: 10, y: 0 },
      { id: 'v3', x: 10, y: 10 },
      { id: 'v4', x: 0, y: 10 },
    ];
    expect(calculatePolygonArea(square)).toBe(100);

    // Reversed order should be the same absolute area
    const reversed = [...square].reverse();
    expect(calculatePolygonArea(reversed)).toBe(100);

    // Less than 3 vertices
    expect(calculatePolygonArea([{ id: 'v1', x: 0, y: 0 }])).toBe(0);
    expect(calculatePolygonArea([{ id: 'v1', x: 0, y: 0 }, { id: 'v2', x: 10, y: 0 }])).toBe(0);
  });

  it('calculates total level area', () => {
    expect(calculateLevelArea([10.5, 20.2, 5])).toBe(35.7);
    expect(calculateLevelArea([])).toBe(0);
  });

  it('formats area string correctly', () => {
    // Note: spaces/commas depends on runtime Intl, but standard is comma for vi-VN
    const formatted = formatAreaM2(248.6);
    expect(formatted.replace(/\s/g, ' ')).toContain('248,60 m²'); // normalize narrow no-break space
  });
});
