import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleFurnitureId, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { levelOfGraph, objectPlacementsOf, objectsOf, scaleOfLevel, solidWallsOf } from './objectLayerReviewGateway';

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
