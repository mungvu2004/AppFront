import { describe, it, expect } from 'vitest';
import { MOCK_SPATIAL_PROJECT } from './spatial';

describe('mocks/spatial.ts', () => {
  it('satisfies the brief requirements for counts', () => {
    const geom = MOCK_SPATIAL_PROJECT.geometry['L1']!;
    expect(Object.keys(geom.walls).length).toBe(48);
    expect(Object.keys(geom.doors).length).toBe(9);
    expect(Object.keys(geom.windows).length).toBe(7);
    expect(Object.keys(geom.furniture).length).toBe(5);
    expect(Object.keys(geom.dimensions).length).toBe(34);
    expect(Object.keys(geom.rooms).length).toBe(14);
    expect(MOCK_SPATIAL_PROJECT.levels.length).toBe(4);
  });

  it('satisfies the brief requirement for total area', () => {
    const geom = MOCK_SPATIAL_PROJECT.geometry['L1']!;
    const totalArea = Object.values(geom.rooms).reduce((sum, r) => sum + r.area_m2!, 0);
    expect(totalArea).toBeCloseTo(248.60, 2);
  });
});
