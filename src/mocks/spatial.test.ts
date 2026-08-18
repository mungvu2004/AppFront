/**
 * Pins the server-shaped mock payload to the domain sample building.
 *
 * Two sample datasets describe "the" sample project: this payload (the shape
 * the server sends) and `src/domain/spatial/__fixtures__/sampleBuilding` (the
 * shape the app holds). They are maintained by hand in two places, which is
 * exactly how sample data drifts — so every figure here is asserted against
 * the constants the domain fixture exports, not against numbers retyped into
 * this file. When either side changes, this test goes red instead of the two
 * datasets quietly telling different stories.
 */

import { describe, expect, it } from 'vitest';

import {
  SAMPLE_DIMENSION_COUNT,
  SAMPLE_DOOR_COUNT,
  SAMPLE_LEVEL_COUNT,
  SAMPLE_ROOM_COUNT,
  SAMPLE_TOTAL_AREA_M2,
  SAMPLE_WALL_COUNT,
  SAMPLE_WINDOW_COUNT,
} from '@/domain/spatial/__fixtures__/sampleBuilding';

import { MOCK_SPATIAL_PROJECT } from './spatial';

describe('mocks/spatial.ts', () => {
  it('carries the same standard counts as the domain sample building', () => {
    const geom = MOCK_SPATIAL_PROJECT.geometry['L1']!;

    expect(Object.keys(geom.walls)).toHaveLength(SAMPLE_WALL_COUNT);
    expect(Object.keys(geom.doors)).toHaveLength(SAMPLE_DOOR_COUNT);
    expect(Object.keys(geom.windows)).toHaveLength(SAMPLE_WINDOW_COUNT);
    expect(Object.keys(geom.dimensions)).toHaveLength(SAMPLE_DIMENSION_COUNT);
    expect(Object.keys(geom.rooms)).toHaveLength(SAMPLE_ROOM_COUNT);
    expect(MOCK_SPATIAL_PROJECT.levels).toHaveLength(SAMPLE_LEVEL_COUNT);
  });

  it('keeps its deliberate furniture slice at 5 items', () => {
    // The standard set holds 21 furniture items spread over four levels
    // (SAMPLE_FURNITURE_COUNT); this payload only details level L1 and its
    // own brief fixed that slice at 5. Asserted here so the divergence stays
    // a decision on record rather than an accident nobody notices.
    const geom = MOCK_SPATIAL_PROJECT.geometry['L1']!;

    expect(Object.keys(geom.furniture)).toHaveLength(5);
  });

  it('sums its room areas to the standard total of 248,60 m²', () => {
    const geom = MOCK_SPATIAL_PROJECT.geometry['L1']!;
    const totalArea = Object.values(geom.rooms).reduce((sum, room) => sum + (room.area_m2 ?? 0), 0);

    expect(totalArea).toBeCloseTo(SAMPLE_TOTAL_AREA_M2, 2);
  });
});
