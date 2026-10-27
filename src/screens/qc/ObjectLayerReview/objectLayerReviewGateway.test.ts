import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleFurnitureId, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import {
  levelOfGraph,
  objectPlacementsOf,
  objectsOf,
  scaleOfLevel,
  solidWallsOf,
  toObjectRow,
  toPaintSubject,
} from './objectLayerReviewGateway';

describe('objectLayerReviewGateway: free furniture rotation (K1)', () => {
  it('draws a 2000x600 free item at 90 deg with its own rotation and unrotated bounds', () => {
    const building = createSampleBuilding();
    const levelId = sampleLevelId(0);
    const id = sampleFurnitureId(0);
    building.furniture = building.furniture.map((item) =>
      item.id === id
        ? {
            ...item,
            levelId,
            centre: { x: 5000, y: 4000 },
            boundingBox: { min: { x: 4000, y: 3700 }, max: { x: 6000, y: 4300 } },
            rotationDeg: 90,
          }
        : item,
    );
    const graph = normalizeSpatial(building);
    const level = levelOfGraph(graph, levelId);

    const objects = objectsOf(graph, level, []);
    const index = objects.findIndex((object) => object.entityId === id);
    const placement = objectPlacementsOf(objects, solidWallsOf(graph, level!), level)[index]!;
    const scale = scaleOfLevel(level);

    expect(placement.angleDeg).toBe(90);
    expect(placement.boundsPx.width).toBeCloseTo(scale.millimetresToPixels(2000 as never));
    expect(placement.boundsPx.height).toBeCloseTo(scale.millimetresToPixels(600 as never));
  });
});

describe('objectLayerReviewGateway: source of an unreviewed entity (FIX-P0-14)', () => {
  const paintSourceOf = (source: 'ai' | 'human', reviewed: boolean) => {
    const building = createSampleBuilding();
    const levelId = sampleLevelId(0);
    const id = sampleFurnitureId(0);

    building.furniture = building.furniture.map((item) =>
      item.id === id ? { ...item, levelId, source, reviewed } : item,
    );

    const graph = normalizeSpatial(building);
    const object = objectsOf(graph, levelOfGraph(graph, levelId), []).find(
      (candidate) => candidate.entityId === id,
    )!;

    return toPaintSubject(object, levelId).review.source;
  };

  it('keeps human on a hand-drawn entity that is not reviewed (review then un-review)', () => {
    expect(paintSourceOf('human', false)).toBe('human');
  });

  it('keeps ai on an unreviewed AI entity', () => {
    expect(paintSourceOf('ai', false)).toBe('ai');
  });

  it('reports human on a reviewed entity', () => {
    expect(paintSourceOf('human', true)).toBe('human');
  });
});

describe('objectLayerReviewGateway: list row names and attention (K07)', () => {
  const rowOf = (patch: { kind?: 'wardrobe' | 'other'; confidence?: number; reviewed?: boolean }) => {
    const building = createSampleBuilding();
    const levelId = sampleLevelId(0);
    const id = sampleFurnitureId(0);

    building.furniture = building.furniture.map((item) =>
      item.id === id ? ({ ...item, levelId, ...patch } as typeof item) : item,
    );

    const graph = normalizeSpatial(building);
    const object = objectsOf(graph, levelOfGraph(graph, levelId), []).find(
      (candidate) => candidate.entityId === id,
    )!;

    return toObjectRow(object);
  };

  it('names free furniture by its graph kind, not "Nội thất khác"', () => {
    expect(rowOf({ kind: 'wardrobe' }).typeLabel).toBe('Tủ áo');
    expect(rowOf({ kind: 'other' }).typeLabel).toBe('Nội thất khác');
  });

  it('marks attention only below the confidence threshold, same rule as the header count', () => {
    expect(rowOf({ confidence: 0.8, reviewed: false }).statusCode).toBe('neutral');
    expect(rowOf({ confidence: 0.3, reviewed: false }).statusCode).toBe('attention');
    expect(rowOf({ confidence: 0.3, reviewed: true }).statusCode).toBe('verified');
  });
});
