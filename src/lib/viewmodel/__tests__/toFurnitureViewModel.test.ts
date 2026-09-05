import { describe, expect, it } from 'vitest';

import type { Furniture, FurnitureKind } from '@/domain/spatial/types';
import { FURNITURE_KIND_LABELS as COMMAND_FURNITURE_KIND_LABELS } from '@/lib/commands/business/shared';
import { formatAngle } from '@/lib/format/measure';
import { formatPercent, MISSING_VALUE } from '@/lib/format/number';

import { toFurnitureViewModel, toViewModel, toViewModels } from '../toViewModel';
import { VIEW_ICON_CODES, VIEW_STATUS_CODES, type ViewAttribute, type ViewModel } from '../types';

/* -------------------------------------------------------------------------- */
/* Fixtures.                                                                   */
/* -------------------------------------------------------------------------- */

function makeFurniture(overrides: Partial<Furniture> = {}): Furniture {
  return {
    id: 'F-000009',
    levelId: 'L-01',
    roomId: 'R-000021',
    kind: 'bed',
    centre: { x: 2000, y: 1200 },
    boundingBox: { min: { x: 1500, y: 900 }, max: { x: 2500, y: 1500 } },
    rotationDeg: 90,
    confidence: 0.72,
    source: 'ai',
    reviewed: false,
    ...overrides,
  };
}

/** A piece with no `roomId` at all — the key is absent, not set to `undefined`. */
function makeFurnitureWithoutRoom(overrides: Partial<Omit<Furniture, 'roomId'>> = {}): Furniture {
  return {
    id: 'F-000009',
    levelId: 'L-01',
    kind: 'bed',
    centre: { x: 2000, y: 1200 },
    boundingBox: { min: { x: 1500, y: 900 }, max: { x: 2500, y: 1500 } },
    rotationDeg: 90,
    confidence: 0.72,
    source: 'ai',
    reviewed: false,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers, restated from `toViewModel.test.ts` (not exported there).          */
/* -------------------------------------------------------------------------- */

function attribute(model: ViewModel, label: string): ViewAttribute {
  const found = model.attributes.find((candidate) => candidate.label === label);

  if (found === undefined) {
    throw new Error(`Không có thuộc tính "${label}" trong ${model.attributes.map((a) => a.label).join(', ')}.`);
  }

  return found;
}

/** Vietnamese writes no space before `%` or `°`, and a space before `mm`/`m`/`m²`. */
const NO_SPACE_UNITS = new Set(['%', '°']);

function rejoin(item: ViewAttribute): string {
  if (item.unit === undefined) {
    return item.value;
  }

  return NO_SPACE_UNITS.has(item.unit) ? `${item.value}${item.unit}` : `${item.value} ${item.unit}`;
}

function leaves(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => leaves(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((item: unknown) => leaves(item));
  }

  return [value];
}

const ALL_KINDS: readonly FurnitureKind[] = [
  'table',
  'chair',
  'bed',
  'wardrobe',
  'kitchenCabinet',
  'sanitaryFixture',
  'stair',
  'other',
];

/* -------------------------------------------------------------------------- */
/* toFurnitureViewModel.                                                       */
/* -------------------------------------------------------------------------- */

describe('toFurnitureViewModel', () => {
  it('writes a furniture item as six ready-made fields', () => {
    expect(toFurnitureViewModel(makeFurniture())).toEqual({
      id: 'F-000009',
      label: 'Giường F-000009',
      secondaryLine: 'trong phòng R-000021',
      attributes: [
        { label: 'Chiều rộng', value: '1,00', unit: 'm' },
        { label: 'Chiều sâu', value: '600', unit: 'mm' },
        { label: 'Góc xoay', value: '90,0', unit: '°' },
        { label: 'Độ tin cậy', value: '72', unit: '%' },
      ],
      statusCode: 'attention',
      iconCode: 'furnitureBed',
    });
  });

  it('says honestly when a piece has not been assigned to a room', () => {
    expect(toFurnitureViewModel(makeFurnitureWithoutRoom()).secondaryLine).toBe('chưa gán phòng');
  });

  it('gives every furniture kind its own icon code, and every icon code is in the closed union', () => {
    const codes = ALL_KINDS.map((kind) => toFurnitureViewModel(makeFurniture({ kind })).iconCode);

    expect(new Set(codes).size).toBe(ALL_KINDS.length);

    for (const code of codes) {
      expect(VIEW_ICON_CODES).toContain(code);
    }
  });

  it('keeps the furniture-kind names identical to the command layer, capitalised for the headline', () => {
    for (const kind of ALL_KINDS) {
      const label = toFurnitureViewModel(makeFurniture({ kind })).label;
      const bareLabel = label.replace(' F-000009', '');

      expect(bareLabel.toLowerCase()).toBe(COMMAND_FURNITURE_KIND_LABELS[kind]);
    }
  });

  it('measures the bounding box, not the rotated footprint', () => {
    const model = toFurnitureViewModel(
      makeFurniture({ boundingBox: { min: { x: 0, y: 0 }, max: { x: 800, y: 400 } } }),
    );

    expect(attribute(model, 'Chiều rộng')).toEqual({ label: 'Chiều rộng', value: '800', unit: 'mm' });
    expect(attribute(model, 'Chiều sâu')).toEqual({ label: 'Chiều sâu', value: '400', unit: 'mm' });
  });

  it('shows a dash for every unusable furniture measurement, and never throws', () => {
    const hostile: readonly number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (const value of hostile) {
      const model = toFurnitureViewModel(
        makeFurniture({
          rotationDeg: value,
          confidence: value,
          boundingBox: { min: { x: value, y: 0 }, max: { x: 0, y: 0 } },
        }),
      );

      expect(model.attributes.filter((item) => item.value === MISSING_VALUE)).toHaveLength(3);
      expect(model.label).toBe('Giường F-000009');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Drift guards.                                                               */
/* -------------------------------------------------------------------------- */

describe('agreement with src/lib/format', () => {
  it('rejoins a rotation into exactly what formatAngle writes', () => {
    for (const rotationDeg of [0, 1, 90, 180, -45.25, 359.95]) {
      const model = toFurnitureViewModel(makeFurniture({ rotationDeg }));

      expect(rejoin(attribute(model, 'Góc xoay'))).toBe(formatAngle(rotationDeg));
    }
  });

  it('rejoins a confidence into exactly what formatPercent writes', () => {
    for (const confidence of [0, 0.4, 0.72, 0.95, 1]) {
      const model = toFurnitureViewModel(makeFurniture({ confidence }));

      expect(rejoin(attribute(model, 'Độ tin cậy'))).toBe(formatPercent(confidence, { fractionDigits: 0 }));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Invariant A5: the verified green belongs to a person.                       */
/* -------------------------------------------------------------------------- */

describe('status codes', () => {
  it('gives verified only to what a person approved', () => {
    expect(toFurnitureViewModel(makeFurniture({ reviewed: true, source: 'human' })).statusCode).toBe('verified');
  });

  it('never lets an AI score reach verified, however high', () => {
    for (const confidence of [0, 0.4, 0.72, 0.9, 0.99, 1]) {
      expect(
        toFurnitureViewModel(makeFurniture({ reviewed: false, source: 'ai', confidence })).statusCode,
      ).not.toBe('verified');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The dispatcher.                                                             */
/* -------------------------------------------------------------------------- */

describe('toViewModel with a furniture input', () => {
  it('agrees with the builder', () => {
    const furniture = makeFurniture();

    expect(toViewModel({ kind: 'furniture', furniture })).toEqual(toFurnitureViewModel(furniture));
  });

  it('takes its place in a mixed list', () => {
    const models = toViewModels([{ kind: 'furniture', furniture: makeFurniture() }]);

    expect(models.map((model) => model.iconCode)).toEqual(['furnitureBed']);
  });
});

/* -------------------------------------------------------------------------- */
/* The constraints every kind is promised.                                     */
/* -------------------------------------------------------------------------- */

describe('the shape a view is promised', () => {
  it('never puts a number anywhere in a furniture view model', () => {
    for (const model of ALL_KINDS.map((kind) => toFurnitureViewModel(makeFurniture({ kind })))) {
      for (const leaf of leaves(model)) {
        expect(typeof leaf).toBe('string');
      }
    }
  });

  it('carries no colour, only one of the four status codes', () => {
    const colour = /(#([0-9a-fA-F]{3}){1,2}\b)|(rgb|hsl)a?\(/;
    const model = toFurnitureViewModel(makeFurniture());

    expect(VIEW_STATUS_CODES).toContain(model.statusCode);

    for (const leaf of leaves(model)) {
      expect(String(leaf)).not.toMatch(colour);
    }
  });

  it('leaves the unit off a missing reading, so no dash reads as a measurement', () => {
    const item = attribute(toFurnitureViewModel(makeFurniture({ rotationDeg: Number.NaN })), 'Góc xoay');

    expect(item.value).toBe(MISSING_VALUE);
    expect('unit' in item).toBe(false);
  });
});
