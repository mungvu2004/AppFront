import { describe, expect, it } from 'vitest';

import { createSampleBuilding, sampleFurnitureId, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import {
  buildChangeFurnitureKindCommand,
  drawnFurnitureInputOf,
  levelOfGraph,
  objectPlacementsOf,
  objectsOf,
  scaleOfLevel,
  solidWallsOf,
  toObjectInspector,
  toObjectRow,
  toPaintSubject,
} from './objectLayerReviewGateway';
import { clientToViewBoxPoint } from './objectLayerSymbols';

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
  const objectOf = (patch: { kind?: 'wardrobe' | 'kitchenCabinet' | 'other'; confidence?: number; reviewed?: boolean }) => {
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

    return object;
  };
  const rowOf = (patch: Parameters<typeof objectOf>[0]) => toObjectRow(objectOf(patch));

  it('names free furniture by its graph kind, not "Nội thất khác"', () => {
    expect(rowOf({ kind: 'wardrobe' }).typeLabel).toBe('Tủ áo');
    expect(rowOf({ kind: 'other' }).typeLabel).toBe('Nội thất khác');
  });

  it('marks attention only below the confidence threshold, same rule as the header count', () => {
    expect(rowOf({ confidence: 0.8, reviewed: false }).statusCode).toBe('neutral');
    expect(rowOf({ confidence: 0.3, reviewed: false }).statusCode).toBe('attention');
    expect(rowOf({ confidence: 0.3, reviewed: true }).statusCode).toBe('verified');
  });

  it('K10: the inspector uses the list name, Rộng × Sâu and confidence in words', () => {
    const object = objectOf({ kind: 'kitchenCabinet', confidence: 0.26 });
    const inspector = toObjectInspector(object, null);

    expect(inspector.typeLabel).toBe(toObjectRow(object).typeLabel);
    expect(inspector.typeLabel).toBe('Tủ bếp');
    expect(inspector.furnitureKind).toBe('kitchenCabinet');
    expect(inspector.sizeLabel).toBe(toObjectRow(object).sizeLabel);
    expect(inspector.confidenceLabel).toBe('Máy chưa chắc');
    expect(toObjectInspector(objectOf({ confidence: 0.95 }), null).confidenceLabel).toBe('Máy khá chắc');
  });
});

describe('objectLayerReviewGateway: furniture kind change and drawing (K10, K07)', () => {
  it('changes only the graph kind, and refuses the same kind', () => {
    const id = sampleFurnitureId(0);
    const before = normalizeSpatial(createSampleBuilding()).byId[id];

    if (before === undefined || !('boundingBox' in before)) {
      throw new Error('sample furniture missing');
    }

    expect(buildChangeFurnitureKindCommand({ ...before, kind: 'other' }, 'wardrobe', 'u-1', 'F-001').ok).toBe(true);
    expect(buildChangeFurnitureKindCommand({ ...before, kind: 'wardrobe' }, 'wardrobe', 'u-1', 'F-001').ok).toBe(false);
  });

  it('draws a 600 x 600 furniture box centred on the clicked point', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const input = drawnFurnitureInputOf(levelOfGraph(graph, sampleLevelId(0))!, { x: 1000, y: 2000 });

    expect(input.centre).toEqual({ x: 1000, y: 2000 });
    expect(input.boundingBox).toEqual({ min: { x: 700, y: 1700 }, max: { x: 1300, y: 2300 } });
  });

  it('maps a screen click onto the svg viewBox (xMidYMid meet)', () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    const viewBox = { x: 10, y: 20, width: 200, height: 200 };

    /* factor = min(2, 1) = 1; 100 px of letterbox on each side. */
    expect(clientToViewBoxPoint(rect, viewBox, 200, 50)).toEqual({ x: 10, y: 20 });
    expect(clientToViewBoxPoint(rect, viewBox, 300, 150)).toEqual({ x: 110, y: 120 });
    expect(clientToViewBoxPoint({ ...rect, width: 0 }, viewBox, 0, 0)).toBeNull();
  });
});
