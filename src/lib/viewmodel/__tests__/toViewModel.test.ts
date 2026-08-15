import { describe, expect, it } from 'vitest';

import { OPENING_KIND_LABELS } from '@/domain/openings/types';
import { ROOM_USAGE_LABELS, RULE_SEVERITY_LABELS, type RuleSeverity, type Violation } from '@/domain/rules/registry';
import type { Opening, Room, Wall } from '@/domain/spatial/types';
import { WALL_KIND_LABELS as COMMAND_WALL_KIND_LABELS } from '@/lib/commands/business/shared';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatPercent, MISSING_VALUE } from '@/lib/format/number';
import {
  toOpeningViewModel,
  toRoomViewModel,
  toViewModel,
  toViewModels,
  toViolationViewModel,
  toWallViewModel,
  UNNAMED_ROOM_LABEL,
} from '../toViewModel';
import { VIEW_ICON_CODES, VIEW_STATUS_CODES, type ViewAttribute, type ViewModel } from '../types';

/* -------------------------------------------------------------------------- */
/* The standard sample set (invariant A14).                                    */
/* -------------------------------------------------------------------------- */

/** 48 walls, 21 axes, 34 rooms, 14 openings, 4 levels — and 248,60 m². */
const SAMPLE_WALL_COUNT = 48;
const SAMPLE_ROOM_COUNT = 34;
const SAMPLE_OPENING_COUNT = 14;
const SAMPLE_AREA_M2 = 248.6;

function makeWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: 'W-000014',
    levelId: 'L-01',
    centreline: { start: { x: 0, y: 0 }, end: { x: 3450, y: 0 } },
    thicknessMm: 220,
    heightMm: 2800,
    kind: 'loadBearing',
    openingIds: ['D-000003', 'D-000004'],
    confidence: 0.95,
    source: 'ai',
    reviewed: false,
    ...overrides,
  };
}

function makeOpening(overrides: Partial<Opening> = {}): Opening {
  return {
    id: 'D-000003',
    wallId: 'W-000014',
    kind: 'door',
    offsetMm: 1200,
    widthMm: 900,
    heightMm: 2200,
    sillHeightMm: 0,
    swing: 'left',
    confidence: 0.72,
    source: 'ai',
    reviewed: false,
    ...overrides,
  };
}

/** A 21 m × 11,84 m rectangle: 248,60 m², to the centimetre. */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'R-000021',
    levelId: 'L-01',
    name: 'Phòng khách',
    usage: 'livingRoom',
    outline: [
      { x: 0, y: 0 },
      { x: 21000, y: 0 },
      { x: 21000, y: 11838 },
      { x: 0, y: 11838 },
    ],
    areaM2: SAMPLE_AREA_M2,
    wallIds: ['W-000014', 'W-000015', 'W-000016', 'W-000017'],
    confidence: 0.98,
    source: 'human',
    reviewed: true,
    ...overrides,
  };
}

function makeViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    ruleCode: 'WALL-THICKNESS',
    severity: 'warning',
    levelId: 'L-01',
    entityId: 'W-000014',
    message: 'Tường W-000014 dày 40 mm, ngoài khoảng 60 mm đến 400 mm.',
    suggestion: 'Tăng bề dày lên tối thiểu 60 mm, hoặc xoá nếu đây là nét thừa.',
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers the assertions share.                                               */
/* -------------------------------------------------------------------------- */

/** Every view model the four builders can produce, for the blanket checks. */
function everyKind(): readonly ViewModel[] {
  return [
    toWallViewModel(makeWall()),
    toWallViewModel(makeWall({ kind: 'partition', reviewed: true, source: 'human' })),
    toWallViewModel(makeWall({ kind: 'envelope', confidence: 0.4 })),
    toOpeningViewModel(makeOpening()),
    toOpeningViewModel(makeOpening({ kind: 'window', swing: 'fixed', sillHeightMm: 900 })),
    toRoomViewModel(makeRoom()),
    toRoomViewModel(makeRoom({ name: '   ', usage: 'corridor', reviewed: false })),
    toViolationViewModel(makeViolation()),
    toViolationViewModel(makeViolation({ severity: 'critical', levelId: null })),
    toViolationViewModel(makeViolation({ severity: 'suggestion' })),
  ];
}

/** The attribute with this label, or a failure that names what was missing. */
function attribute(model: ViewModel, label: string): ViewAttribute {
  const found = model.attributes.find((candidate) => candidate.label === label);

  if (found === undefined) {
    throw new Error(`Không có thuộc tính "${label}" trong ${model.attributes.map((a) => a.label).join(', ')}.`);
  }

  return found;
}

/**
 * The reading rejoined the way a view would print it.
 *
 * Vietnamese writes a space before `mm`, `m` and `m²` and none before `%`, which
 * is what `Intl` does, so this mirrors the formatters rather than inventing a
 * spacing rule of its own.
 */
function rejoin(item: ViewAttribute): string {
  if (item.unit === undefined) {
    return item.value;
  }

  return item.unit === '%' ? `${item.value}${item.unit}` : `${item.value} ${item.unit}`;
}

/** Every leaf of a view model, so a blanket check can walk it. */
function leaves(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => leaves(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((item: unknown) => leaves(item));
  }

  return [value];
}

/* -------------------------------------------------------------------------- */
/* The four models.                                                            */
/* -------------------------------------------------------------------------- */

describe('toWallViewModel', () => {
  it('writes a wall as six ready-made fields', () => {
    expect(toWallViewModel(makeWall())).toEqual({
      id: 'W-000014',
      label: 'Tường W-000014',
      secondaryLine: 'tường chịu lực',
      attributes: [
        { label: 'Bề dày', value: '220', unit: 'mm' },
        { label: 'Chiều dài', value: '3,45', unit: 'm' },
        { label: 'Chiều cao', value: '2,80', unit: 'm' },
        { label: 'Ô mở', value: '2' },
        { label: 'Độ tin cậy', value: '95', unit: '%' },
      ],
      statusCode: 'neutral',
      iconCode: 'wallLoadBearing',
    });
  });

  it('names every wall kind and gives each its own icon code', () => {
    expect(toWallViewModel(makeWall({ kind: 'partition' })).secondaryLine).toBe('vách ngăn');
    expect(toWallViewModel(makeWall({ kind: 'envelope' })).iconCode).toBe('wallEnvelope');
  });

  it('counts the sample set without turning the count into a measurement', () => {
    const openingIds = Array.from({ length: SAMPLE_OPENING_COUNT }, (_unused, index) => `D-${String(index)}` as const);
    const item = attribute(toWallViewModel(makeWall({ openingIds })), 'Ô mở');

    expect(item).toEqual({ label: 'Ô mở', value: '14' });
  });
});

describe('toOpeningViewModel', () => {
  it('writes a door as six ready-made fields', () => {
    expect(toOpeningViewModel(makeOpening())).toEqual({
      id: 'D-000003',
      label: 'Cửa đi D-000003',
      secondaryLine: 'trên tường W-000014',
      attributes: [
        { label: 'Bề rộng', value: '900', unit: 'mm' },
        { label: 'Chiều cao', value: '2,20', unit: 'm' },
        { label: 'Cao bệ', value: '0', unit: 'mm' },
        { label: 'Vị trí trên tường', value: '1,20', unit: 'm' },
        { label: 'Chiều mở', value: 'mở trái' },
        { label: 'Độ tin cậy', value: '72', unit: '%' },
      ],
      statusCode: 'attention',
      iconCode: 'openingDoor',
    });
  });

  it('takes the kind name from the domain rather than restating it', () => {
    expect(toOpeningViewModel(makeOpening({ kind: 'window' })).label).toBe(
      `${OPENING_KIND_LABELS.window} D-000003`,
    );
    expect(toOpeningViewModel(makeOpening({ kind: 'window' })).iconCode).toBe('openingWindow');
  });

  it('names every swing direction', () => {
    const swings = ['left', 'right', 'double', 'sliding', 'fixed'] as const;
    const written = swings.map((swing) => attribute(toOpeningViewModel(makeOpening({ swing })), 'Chiều mở').value);

    expect(written).toEqual(['mở trái', 'mở phải', 'hai cánh', 'trượt', 'cố định']);
  });
});

describe('toRoomViewModel', () => {
  it('writes a room as six ready-made fields, with the sample area', () => {
    expect(toRoomViewModel(makeRoom())).toEqual({
      id: 'R-000021',
      label: 'Phòng khách',
      secondaryLine: 'phòng khách',
      attributes: [
        { label: 'Diện tích', value: '248,60', unit: 'm²' },
        { label: 'Chu vi', value: '65,68', unit: 'm' },
        { label: 'Tường bao', value: '4' },
        { label: 'Độ tin cậy', value: '98', unit: '%' },
      ],
      statusCode: 'verified',
      iconCode: 'room',
    });
  });

  it('gives a nameless room a headline rather than an empty one', () => {
    expect(toRoomViewModel(makeRoom({ name: '' })).label).toBe(UNNAMED_ROOM_LABEL);
    expect(toRoomViewModel(makeRoom({ name: '   ' })).label).toBe(UNNAMED_ROOM_LABEL);
  });

  it('takes the usage name from the rule book rather than restating it', () => {
    expect(toRoomViewModel(makeRoom({ usage: 'stairwell' })).secondaryLine).toBe(ROOM_USAGE_LABELS.stairwell);
  });

  it('shows a dash for a perimeter it cannot measure, and never throws', () => {
    const broken = toRoomViewModel(makeRoom({ outline: [{ x: Number.NaN, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }] }));

    expect(attribute(broken, 'Chu vi')).toEqual({ label: 'Chu vi', value: MISSING_VALUE });
    expect(attribute(broken, 'Diện tích').value).toBe('248,60');
  });

  it('shows a dash for an outline too short to close', () => {
    expect(attribute(toRoomViewModel(makeRoom({ outline: [] })), 'Chu vi').value).toBe(MISSING_VALUE);
  });
});

describe('toViolationViewModel', () => {
  it('writes a violation as six ready-made fields', () => {
    expect(toViolationViewModel(makeViolation())).toEqual({
      id: 'WALL-THICKNESS:W-000014',
      label: 'Tường W-000014 dày 40 mm, ngoài khoảng 60 mm đến 400 mm.',
      secondaryLine: 'Tăng bề dày lên tối thiểu 60 mm, hoặc xoá nếu đây là nét thừa.',
      attributes: [
        { label: 'Mã luật', value: 'WALL-THICKNESS' },
        { label: 'Mức độ', value: 'cảnh báo' },
        { label: 'Đối tượng', value: 'W-000014' },
        { label: 'Tầng', value: 'L-01' },
      ],
      statusCode: 'attention',
      iconCode: 'violationWarning',
    });
  });

  it('keys a violation by rule and entity together', () => {
    const first = toViolationViewModel(makeViolation({ entityId: 'W-000014' }));
    const second = toViolationViewModel(makeViolation({ entityId: 'W-000015' }));

    expect(first.id).not.toBe(second.id);
  });

  it('reserves the violation code for a critical finding', () => {
    const severities: readonly RuleSeverity[] = ['critical', 'warning', 'suggestion'];
    const codes = severities.map((severity) => toViolationViewModel(makeViolation({ severity })).statusCode);

    expect(codes).toEqual(['violation', 'attention', 'neutral']);
  });

  it('takes the severity name from the rule book rather than restating it', () => {
    const severities: readonly RuleSeverity[] = ['critical', 'warning', 'suggestion'];

    for (const severity of severities) {
      expect(attribute(toViolationViewModel(makeViolation({ severity })), 'Mức độ').value).toBe(
        RULE_SEVERITY_LABELS[severity],
      );
    }
  });

  it('shows a dash for a building-wide finding with no level', () => {
    expect(attribute(toViolationViewModel(makeViolation({ levelId: null })), 'Tầng').value).toBe(MISSING_VALUE);
  });
});

/* -------------------------------------------------------------------------- */
/* The dispatcher.                                                             */
/* -------------------------------------------------------------------------- */

describe('toViewModel', () => {
  it('agrees with the builder for each of the four kinds', () => {
    const wall = makeWall();
    const opening = makeOpening();
    const room = makeRoom();
    const violation = makeViolation();

    expect(toViewModel({ kind: 'wall', wall })).toEqual(toWallViewModel(wall));
    expect(toViewModel({ kind: 'opening', opening })).toEqual(toOpeningViewModel(opening));
    expect(toViewModel({ kind: 'room', room })).toEqual(toRoomViewModel(room));
    expect(toViewModel({ kind: 'violation', violation })).toEqual(toViolationViewModel(violation));
  });

  it('keeps the order of a mixed list', () => {
    const models = toViewModels([
      { kind: 'room', room: makeRoom() },
      { kind: 'violation', violation: makeViolation() },
      { kind: 'wall', wall: makeWall() },
    ]);

    expect(models.map((model) => model.iconCode)).toEqual(['room', 'violationWarning', 'wallLoadBearing']);
  });
});

/* -------------------------------------------------------------------------- */
/* The constraints, checked across every model at once.                        */
/* -------------------------------------------------------------------------- */

describe('the shape a view is promised', () => {
  it('never puts a number anywhere in a view model', () => {
    for (const model of everyKind()) {
      for (const leaf of leaves(model)) {
        expect(typeof leaf).toBe('string');
      }
    }
  });

  it('gives every attribute a string value', () => {
    for (const model of everyKind()) {
      for (const item of model.attributes) {
        expect(typeof item.value).toBe('string');
        expect(item.value).not.toBe('');
        expect(item.value).not.toMatch(/NaN|Infinity|undefined|null/);
      }
    }
  });

  it('writes decimals with a comma and thousands with a dot (A15)', () => {
    const long = attribute(
      toWallViewModel(makeWall({ centreline: { start: { x: 0, y: 0 }, end: { x: 999, y: 0 } } })),
      'Chiều dài',
    );

    expect(long).toEqual({ label: 'Chiều dài', value: '999', unit: 'mm' });
    expect(attribute(toRoomViewModel(makeRoom({ areaM2: 1234.5 })), 'Diện tích').value).toBe('1.234,50');
  });

  it('carries no colour, only one of the four status codes', () => {
    const colour = /(#([0-9a-fA-F]{3}){1,2}\b)|(rgb|hsl)a?\(/;

    for (const model of everyKind()) {
      expect(VIEW_STATUS_CODES).toContain(model.statusCode);
      expect(VIEW_ICON_CODES).toContain(model.iconCode);

      for (const leaf of leaves(model)) {
        expect(String(leaf)).not.toMatch(colour);
      }
    }
  });

  it('leaves the unit off a reading that has none, rather than writing undefined', () => {
    const item = attribute(toWallViewModel(makeWall()), 'Ô mở');

    expect('unit' in item).toBe(false);
  });

  it('leaves the unit off a missing reading, so no dash reads as a measurement', () => {
    const item = attribute(toWallViewModel(makeWall({ thicknessMm: Number.NaN })), 'Bề dày');

    expect(item.value).toBe(MISSING_VALUE);
    expect('unit' in item).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Drift guards.                                                               */
/* -------------------------------------------------------------------------- */

describe('agreement with src/lib/format', () => {
  const LENGTHS_MM: readonly number[] = [0, 1, 220, 850, 999, 1000, 2800, 3450, 12400, -3450, 1234567];

  it('rejoins a length into exactly what formatLength writes', () => {
    for (const lengthMm of LENGTHS_MM) {
      const model = toWallViewModel(makeWall({ thicknessMm: lengthMm }));

      expect(rejoin(attribute(model, 'Bề dày'))).toBe(formatLength(lengthMm));
    }
  });

  it('rejoins an area into exactly what formatArea writes', () => {
    for (const areaM2 of [0, 2.5, SAMPLE_AREA_M2, 1234.5]) {
      const model = toRoomViewModel(makeRoom({ areaM2 }));

      expect(rejoin(attribute(model, 'Diện tích'))).toBe(formatArea(areaM2));
    }
  });

  it('rejoins a confidence into exactly what formatPercent writes', () => {
    for (const confidence of [0, 0.4, 0.72, 0.95, 1]) {
      const model = toWallViewModel(makeWall({ confidence }));

      expect(rejoin(attribute(model, 'Độ tin cậy'))).toBe(formatPercent(confidence, { fractionDigits: 0 }));
    }
  });

  it('keeps the wall-kind names identical to the command layer', () => {
    const written = (['loadBearing', 'partition', 'envelope'] as const).map(
      (kind) => toWallViewModel(makeWall({ kind })).secondaryLine,
    );

    expect(written).toEqual([
      COMMAND_WALL_KIND_LABELS.loadBearing,
      COMMAND_WALL_KIND_LABELS.partition,
      COMMAND_WALL_KIND_LABELS.envelope,
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Invariant A5: the verified green belongs to a person.                       */
/* -------------------------------------------------------------------------- */

describe('status codes', () => {
  it('gives verified only to what a person approved', () => {
    expect(toWallViewModel(makeWall({ reviewed: true, source: 'human' })).statusCode).toBe('verified');
    expect(toWallViewModel(makeWall({ reviewed: true, confidence: 0 })).statusCode).toBe('verified');
  });

  it('never lets an AI score reach verified, however high', () => {
    for (const confidence of [0, 0.4, 0.72, 0.9, 0.99, 1]) {
      expect(toWallViewModel(makeWall({ reviewed: false, source: 'ai', confidence })).statusCode).not.toBe(
        'verified',
      );
    }
  });

  it('asks for attention below AI-certain and stays quiet above it', () => {
    expect(toWallViewModel(makeWall({ confidence: 0.95 })).statusCode).toBe('neutral');
    expect(toWallViewModel(makeWall({ confidence: 0.72 })).statusCode).toBe('attention');
    expect(toWallViewModel(makeWall({ confidence: Number.NaN })).statusCode).toBe('attention');
  });
});

/* -------------------------------------------------------------------------- */
/* Hostile input.                                                              */
/* -------------------------------------------------------------------------- */

describe('unusable readings', () => {
  const HOSTILE: readonly number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it('shows the dash for every unusable wall measurement, and never throws', () => {
    for (const value of HOSTILE) {
      const model = toWallViewModel(
        makeWall({
          thicknessMm: value,
          heightMm: value,
          confidence: value,
          centreline: { start: { x: value, y: 0 }, end: { x: 0, y: 0 } },
        }),
      );

      expect(model.attributes.filter((item) => item.value === MISSING_VALUE)).toHaveLength(4);
      expect(model.label).toBe('Tường W-000014');
    }
  });

  it('shows the dash for every unusable opening measurement', () => {
    for (const value of HOSTILE) {
      const model = toOpeningViewModel(
        makeOpening({ widthMm: value, heightMm: value, sillHeightMm: value, offsetMm: value }),
      );

      expect(model.attributes.filter((item) => item.value === MISSING_VALUE)).toHaveLength(4);
    }
  });

  it('still describes a room whose every measurement is unusable', () => {
    const model = toRoomViewModel(makeRoom({ areaM2: Number.NaN, outline: [], wallIds: [] }));

    expect(model.label).toBe('Phòng khách');
    expect(attribute(model, 'Diện tích').value).toBe(MISSING_VALUE);
    expect(attribute(model, 'Tường bao').value).toBe('0');
  });
});

/* -------------------------------------------------------------------------- */
/* The sample set is the one the interface shows.                              */
/* -------------------------------------------------------------------------- */

describe('the standard sample set (A14)', () => {
  it('writes the 48/34/14 counts and the 248,60 m² without a stray separator', () => {
    expect(
      toViewModels([
        { kind: 'room', room: makeRoom() },
        { kind: 'wall', wall: makeWall() },
      ]).map((model) => model.attributes.map(rejoin)),
    ).toEqual([
      ['248,60 m²', '65,68 m', '4', '98%'],
      ['220 mm', '3,45 m', '2,80 m', '2', '95%'],
    ]);

    const counts = [SAMPLE_WALL_COUNT, SAMPLE_ROOM_COUNT, SAMPLE_OPENING_COUNT].map(
      (count) =>
        attribute(toRoomViewModel(makeRoom({ wallIds: Array.from({ length: count }, () => 'W-1' as const) })), 'Tường bao')
          .value,
    );

    expect(counts).toEqual(['48', '34', '14']);
  });
});
