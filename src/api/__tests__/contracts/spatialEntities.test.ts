import { describe, expect, it } from 'vitest';

import {
  AxisSchema,
  BuildingSchema,
  DimensionSchema,
  FurnitureSchema,
  LevelSchema,
  NoteSchema,
  RoomSchema,
  WallSchema,
} from '../../schemas/spatial';
import { denormalizeSpatial, normalizeSpatial } from '@/domain/spatial/normalize';
import { SAMPLE_BUILDING } from '@/domain/spatial/__fixtures__/sampleBuilding';

/**
 * Năm thực thể mới của `spatial.ts` — công trình, tầng, trục, kích thước, ghi chú.
 *
 * Bộ số mượn bộ mẫu chuẩn A14 ở chỗ nó có nghĩa (`L-LEVEL00`, tầng cao 3.900,
 * trục `A`) để người đọc nhận ra cùng công trình mà các màn QC đang hiện —
 * nhưng **không** giải mã thẳng `createSampleBuilding()`: `createdAt` của bộ ấy
 * là `+07:00` và hỏng `isoInstantSchema`. Bài kiểm cho đúng chỗ lệch ấy nằm ở
 * `spatialGraph.test.ts`, nơi đường dẫn `notes[0].createdAt` tồn tại.
 */

const AI_REVIEW = { confidence: 0.82, reviewed: false, source: 'ai' } as const;
const HUMAN_REVIEW = { confidence: 1, reviewed: true, source: 'human' } as const;

const fullBuilding = {
  ...HUMAN_REVIEW,
  address: '12 Lý Thường Kiệt, Hà Nội',
  datumElevationMm: 0,
  grossFloorAreaM2: 248.6,
  name: 'Nhà phố Lý Thường Kiệt',
} as const;

const minimalBuilding = {
  ...HUMAN_REVIEW,
  datumElevationMm: 0,
  name: 'Nhà phố Lý Thường Kiệt',
} as const;

const fullLevel = {
  ...HUMAN_REVIEW,
  areaM2: 62.15,
  elevationMm: 0,
  heightMm: 3900,
  id: 'L-LEVEL00',
  name: 'Tầng trệt',
  order: 0,
  scaleMillimetresPerPixel: 12.5,
} as const;

const minimalLevel = {
  ...HUMAN_REVIEW,
  elevationMm: 0,
  heightMm: 3900,
  id: 'L-LEVEL00',
  name: 'Tầng trệt',
  order: 0,
} as const;

const axis = {
  ...AI_REVIEW,
  direction: 'vertical',
  id: 'A-AXIS000',
  label: 'A',
  levelId: 'L-LEVEL00',
  line: { end: { x: 0, y: 14400 }, start: { x: 0, y: 0 } },
} as const;

const fullDimension = {
  ...AI_REVIEW,
  id: 'M-DIMN000',
  kind: 'linear',
  levelId: 'L-LEVEL00',
  line: { end: { x: 4800, y: -500 }, start: { x: 0, y: -500 } },
  overrideValueMm: 4805,
  referenceIds: ['W-WALL000'],
  valueMm: 4800,
} as const;

const minimalDimension = {
  ...AI_REVIEW,
  id: 'M-DIMN000',
  kind: 'linear',
  levelId: 'L-LEVEL00',
  line: { end: { x: 4800, y: -500 }, start: { x: 0, y: -500 } },
  referenceIds: [],
  valueMm: 4800,
} as const;

const note = {
  ...HUMAN_REVIEW,
  authorId: 'U-1',
  body: 'Đã đối chiếu với bản vẽ khảo sát.',
  createdAt: '2026-08-13T02:00:00.000Z',
  entityId: 'W-WALL000',
  id: 'note-1',
} as const;

/* -------------------------------------------------------------------------- */

describe('BuildingSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(BuildingSchema.parse(fullBuilding)).toStrictEqual({ ...fullBuilding });
  });

  it('nhận mẫu tối thiểu và bỏ hẳn hai khoá vắng mặt', () => {
    expect(BuildingSchema.parse(minimalBuilding)).toStrictEqual({ ...minimalBuilding });
  });

  it('từ chối khoá lạ', () => {
    expect(BuildingSchema.safeParse({ ...minimalBuilding, floorCount: 4 }).success).toBe(false);
  });

  it.each([
    ['address', { ...minimalBuilding, address: null }],
    ['grossFloorAreaM2', { ...minimalBuilding, grossFloorAreaM2: null }],
  ])('từ chối null ở trường tuỳ chọn %s', (_label, body) => {
    expect(BuildingSchema.safeParse(body).success).toBe(false);
  });

  it('nhận cao độ mốc âm — công trình có tầng hầm', () => {
    expect(BuildingSchema.safeParse({ ...minimalBuilding, datumElevationMm: -3000 }).success).toBe(
      true,
    );
  });

  it('từ chối cao độ mốc thập phân và diện tích âm', () => {
    expect(BuildingSchema.safeParse({ ...minimalBuilding, datumElevationMm: 0.5 }).success).toBe(
      false,
    );
    expect(BuildingSchema.safeParse({ ...minimalBuilding, grossFloorAreaM2: -1 }).success).toBe(
      false,
    );
  });

  it('từ chối tên rỗng và địa chỉ rỗng', () => {
    expect(BuildingSchema.safeParse({ ...minimalBuilding, name: '' }).success).toBe(false);
    expect(BuildingSchema.safeParse({ ...minimalBuilding, address: '' }).success).toBe(false);
  });
});

describe('LevelSchema', () => {
  it('nhận mẫu đầy đủ và gán nhãn tỉ lệ bằng millimetresPerPixel()', () => {
    expect(LevelSchema.parse(fullLevel)).toStrictEqual({ ...fullLevel });
  });

  it('nhận mẫu tối thiểu và bỏ hẳn hai khoá vắng mặt', () => {
    expect(LevelSchema.parse(minimalLevel)).toStrictEqual({ ...minimalLevel });
  });

  it('từ chối khoá lạ — scaleStatus thuộc tài liệu tầng, không thuộc tầng', () => {
    expect(LevelSchema.safeParse({ ...minimalLevel, scaleStatus: 'unresolved' }).success).toBe(
      false,
    );
  });

  it.each([
    ['areaM2', { ...minimalLevel, areaM2: null }],
    ['scaleMillimetresPerPixel', { ...minimalLevel, scaleMillimetresPerPixel: null }],
  ])('từ chối null ở trường tuỳ chọn %s', (_label, body) => {
    expect(LevelSchema.safeParse(body).success).toBe(false);
  });

  it('nhận order âm và cao độ âm — tầng hầm là tầng −1', () => {
    expect(LevelSchema.safeParse({ ...minimalLevel, elevationMm: -3000, order: -1 }).success).toBe(
      true,
    );
  });

  it('từ chối chiều cao 0 và chiều cao âm', () => {
    expect(LevelSchema.safeParse({ ...minimalLevel, heightMm: 0 }).success).toBe(false);
    expect(LevelSchema.safeParse({ ...minimalLevel, heightMm: -100 }).success).toBe(false);
  });

  it.each([
    ['0', 0],
    ['âm', -12.5],
    ['vô cực', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('từ chối tỉ lệ %s', (_label, scaleMillimetresPerPixel) => {
    expect(LevelSchema.safeParse({ ...minimalLevel, scaleMillimetresPerPixel }).success).toBe(
      false,
    );
  });

  it('từ chối order thập phân và mã tầng rỗng', () => {
    expect(LevelSchema.safeParse({ ...minimalLevel, order: 1.5 }).success).toBe(false);
    expect(LevelSchema.safeParse({ ...minimalLevel, id: '' }).success).toBe(false);
  });
});

describe('AxisSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(AxisSchema.parse(axis)).toStrictEqual({ ...axis });
  });

  it('mẫu tối thiểu bằng mẫu đầy đủ — không áp dụng: schema không có trường tuỳ chọn', () => {
    expect(AxisSchema.parse(axis)).toStrictEqual({ ...axis });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: schema không có trường tuỳ chọn', () => {
    expect(AxisSchema.safeParse(axis).success).toBe(true);
  });

  it('từ chối khoá lạ', () => {
    expect(AxisSchema.safeParse({ ...axis, gridSpacingMm: 3000 }).success).toBe(false);
  });

  it('từ chối khoá lạ trong line lồng', () => {
    expect(
      AxisSchema.safeParse({ ...axis, line: { ...axis.line, mid: { x: 0, y: 7200 } } }).success,
    ).toBe(false);
  });

  it('từ chối hướng ngoài hai giá trị', () => {
    expect(AxisSchema.safeParse({ ...axis, direction: 'diagonal' }).success).toBe(false);
  });

  it('từ chối nhãn rỗng', () => {
    expect(AxisSchema.safeParse({ ...axis, label: '' }).success).toBe(false);
  });

  it('từ chối trục dài 0 mm — segmentSchema đã chặn từ trước', () => {
    expect(
      AxisSchema.safeParse({ ...axis, line: { end: { x: 0, y: 0 }, start: { x: 0, y: 0 } } })
        .success,
    ).toBe(false);
  });
});

describe('DimensionSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(DimensionSchema.parse(fullDimension)).toStrictEqual({ ...fullDimension });
  });

  it('nhận mẫu tối thiểu, referenceIds rỗng, và bỏ hẳn overrideValueMm', () => {
    expect(DimensionSchema.parse(minimalDimension)).toStrictEqual({ ...minimalDimension });
  });

  it('từ chối khoá lạ', () => {
    expect(DimensionSchema.safeParse({ ...minimalDimension, unit: 'mm' }).success).toBe(false);
  });

  it('từ chối null ở trường tuỳ chọn overrideValueMm', () => {
    expect(DimensionSchema.safeParse({ ...minimalDimension, overrideValueMm: null }).success).toBe(
      false,
    );
  });

  it('từ chối loại ngoài năm giá trị', () => {
    expect(DimensionSchema.safeParse({ ...minimalDimension, kind: 'area' }).success).toBe(false);
  });

  it('từ chối giá trị thập phân — milimét là số nguyên', () => {
    expect(DimensionSchema.safeParse({ ...minimalDimension, valueMm: 4800.5 }).success).toBe(false);
  });

  it('từ chối mã tham chiếu rỗng', () => {
    expect(DimensionSchema.safeParse({ ...minimalDimension, referenceIds: [''] }).success).toBe(
      false,
    );
  });

  it('refine chiều dài: loại khác elevation phải có valueMm dương', () => {
    const parsed = DimensionSchema.safeParse({ ...minimalDimension, valueMm: 0 });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues[0]?.path).toStrictEqual(['valueMm']);
  });

  it('refine chiều dài: cao độ được phép bằng 0 và âm', () => {
    expect(
      DimensionSchema.safeParse({ ...minimalDimension, kind: 'elevation', valueMm: 0 }).success,
    ).toBe(true);
    expect(
      DimensionSchema.safeParse({ ...minimalDimension, kind: 'elevation', valueMm: -3000 }).success,
    ).toBe(true);
  });
});

describe('NoteSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(NoteSchema.parse(note)).toStrictEqual({ ...note });
  });

  it('mẫu tối thiểu bằng mẫu đầy đủ — không áp dụng: schema không có trường tuỳ chọn', () => {
    expect(NoteSchema.parse(note)).toStrictEqual({ ...note });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: schema không có trường tuỳ chọn', () => {
    expect(NoteSchema.safeParse(note).success).toBe(true);
  });

  it('từ chối khoá lạ', () => {
    expect(NoteSchema.safeParse({ ...note, resolvedAt: note.createdAt }).success).toBe(false);
  });

  it('nhận mã ghi chú tự do — NoteId không nằm trong bảng tiền tố', () => {
    expect(NoteSchema.safeParse({ ...note, id: 'ghi-chu-1' }).success).toBe(true);
  });

  it('từ chối mã rỗng, thân rỗng, tác giả rỗng', () => {
    expect(NoteSchema.safeParse({ ...note, id: '' }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...note, body: '' }).success).toBe(false);
    expect(NoteSchema.safeParse({ ...note, authorId: '' }).success).toBe(false);
  });

  it.each([
    ['lệch múi giờ', '2026-08-13T09:00:00+07:00'],
    ['thiếu mili giây', '2026-08-13T02:00:00Z'],
    ['sáu chữ số mili giây', '2026-08-13T02:00:00.000000Z'],
  ])('từ chối createdAt %s', (_label, createdAt) => {
    expect(NoteSchema.safeParse({ ...note, createdAt }).success).toBe(false);
  });
});

describe('A5 — máy không được tự nhận đã duyệt', () => {
  it.each([
    ['công trình', BuildingSchema, minimalBuilding],
    ['tầng', LevelSchema, minimalLevel],
    ['trục', AxisSchema, axis],
    ['kích thước', DimensionSchema, minimalDimension],
    ['ghi chú', NoteSchema, note],
  ])(
    'từ chối %s mang source ai kèm reviewed true, và nêu đúng path reviewed',
    (_label, schema, entity) => {
      const parsed = schema.safeParse({ ...entity, reviewed: true, source: 'ai' });

      expect(parsed.success).toBe(false);
      expect(parsed.success ? [] : parsed.error.issues[0]?.path).toStrictEqual(['reviewed']);
    },
  );

  it.each([
    ['công trình', BuildingSchema, minimalBuilding],
    ['tầng', LevelSchema, minimalLevel],
    ['trục', AxisSchema, axis],
    ['kích thước', DimensionSchema, minimalDimension],
    ['ghi chú', NoteSchema, note],
  ])('vẫn nhận %s của máy chưa duyệt và của người đã duyệt', (_label, schema, entity) => {
    expect(schema.safeParse({ ...entity, reviewed: false, source: 'ai' }).success).toBe(true);
    expect(schema.safeParse({ ...entity, reviewed: true, source: 'human' }).success).toBe(true);
  });

  it.each([
    ['công trình', BuildingSchema, minimalBuilding],
    ['tầng', LevelSchema, minimalLevel],
    ['trục', AxisSchema, axis],
    ['kích thước', DimensionSchema, minimalDimension],
    ['ghi chú', NoteSchema, note],
  ])('từ chối %s có độ tin cậy ngoài khoảng 0..1', (_label, schema, entity) => {
    expect(schema.safeParse({ ...entity, confidence: 1.2 }).success).toBe(false);
    expect(schema.safeParse({ ...entity, confidence: -0.1 }).success).toBe(false);
  });
});

/**
 * Bốn trường tuỳ chọn mới (FE3D-FIX T06): FE đọc được, chưa ghi ra. Vắng là vắng
 * khoá; có thì phải đi qua `.transform()` nguyên vẹn; khoá lạ khác vẫn bị từ chối.
 */
describe('Trường tuỳ chọn của phòng và đồ đạc (finish, variant, heightMm, liftMm)', () => {
  const room = {
    ...AI_REVIEW,
    areaM2: 18.4,
    id: 'R-ROOM0005',
    levelId: 'L-LEVEL00',
    name: 'Phòng khách',
    outline: [
      { x: 0, y: 0 },
      { x: 4800, y: 0 },
      { x: 4800, y: 3600 },
    ],
    usage: 'livingRoom',
    wallIds: ['W-WALL000'],
  } as const;

  const furniture = {
    ...AI_REVIEW,
    boundingBox: { max: { x: 3400, y: 2100 }, min: { x: 1400, y: 1500 } },
    centre: { x: 2400, y: 1800 },
    id: 'F-FURN0001',
    kind: 'other',
    levelId: 'L-LEVEL00',
    rotationDeg: 90,
  } as const;

  it('vắng thì vắng khoá', () => {
    const parsedRoom = RoomSchema.parse(room);
    const parsedFurniture = FurnitureSchema.parse(furniture);

    expect('finish' in parsedRoom).toBe(false);
    expect(['variant', 'heightMm', 'liftMm'].filter((key) => key in parsedFurniture)).toStrictEqual(
      [],
    );
  });

  it('finish: nhận và giữ qua transform, từ chối giá trị lạ', () => {
    expect(RoomSchema.parse({ ...room, finish: 'mosaic' })).toStrictEqual({
      ...room,
      finish: 'mosaic',
    });
    expect(RoomSchema.safeParse({ ...room, finish: 'marble' }).success).toBe(false);
  });

  it('variant: nhận và giữ qua transform, từ chối giá trị lạ', () => {
    expect(FurnitureSchema.parse({ ...furniture, variant: 'sofa' })).toStrictEqual({
      ...furniture,
      variant: 'sofa',
    });
    expect(FurnitureSchema.safeParse({ ...furniture, variant: 'piano' }).success).toBe(false);
  });

  it('heightMm: số nguyên dương, giữ qua transform', () => {
    expect(FurnitureSchema.parse({ ...furniture, heightMm: 850 })).toStrictEqual({
      ...furniture,
      heightMm: 850,
    });
    expect(FurnitureSchema.safeParse({ ...furniture, heightMm: 0 }).success).toBe(false);
    expect(FurnitureSchema.safeParse({ ...furniture, heightMm: 850.5 }).success).toBe(false);
  });

  it('liftMm: số nguyên không âm, giữ qua transform', () => {
    expect(FurnitureSchema.parse({ ...furniture, liftMm: 0 })).toStrictEqual({
      ...furniture,
      liftMm: 0,
    });
    expect(FurnitureSchema.parse({ ...furniture, liftMm: 1200 })).toStrictEqual({
      ...furniture,
      liftMm: 1200,
    });
    expect(FurnitureSchema.safeParse({ ...furniture, liftMm: -1 }).success).toBe(false);
  });

  it('khoá lạ khác vẫn bị từ chối (strict giữ nguyên)', () => {
    expect(RoomSchema.safeParse({ ...room, ceilingMm: 2700 }).success).toBe(false);
    expect(FurnitureSchema.safeParse({ ...furniture, modelUrl: '/x.glb' }).success).toBe(false);
  });
});

/**
 * Trường J-v3 (FE3D-FIX-003 V8): FE đọc được, chưa ghi ra. Vắng là vắng khoá;
 * có thì đi nguyên vẹn qua `.transform()` và qua kho (normalize → denormalize).
 */
describe('Trường J-v3 (floorMaterial, paint, model, slots)', () => {
  const room = {
    ...AI_REVIEW,
    areaM2: 18.4,
    id: 'R-ROOM0005',
    levelId: 'L-LEVEL00',
    name: 'Phòng khách',
    outline: [
      { x: 0, y: 0 },
      { x: 4800, y: 0 },
      { x: 4800, y: 3600 },
    ],
    usage: 'livingRoom',
    wallIds: ['W-WALL000'],
  } as const;

  const wall = {
    ...AI_REVIEW,
    centreline: { end: { x: 4800, y: 0 }, start: { x: 0, y: 0 } },
    heightMm: 3600,
    id: 'W-WALL000',
    kind: 'envelope',
    levelId: 'L-LEVEL00',
    openingIds: [],
    thicknessMm: 200,
  } as const;

  const furniture = {
    ...AI_REVIEW,
    boundingBox: { max: { x: 3400, y: 2100 }, min: { x: 1400, y: 1500 } },
    centre: { x: 2400, y: 1800 },
    id: 'F-FURN0001',
    kind: 'other',
    levelId: 'L-LEVEL00',
    rotationDeg: 90,
  } as const;

  const model = { id: 'sofa-modern', src: '/items/sofa-modern/model.glb' } as const;
  const slots = { body: 'library:linen', legs: 'scene:oak_dark' } as const;

  it('tài liệu cũ vẫn đọc được, vắng thì vắng khoá', () => {
    expect('floorMaterial' in RoomSchema.parse(room)).toBe(false);
    expect('paint' in WallSchema.parse(wall)).toBe(false);
    expect(
      ['model', 'slots'].filter((key) => key in FurnitureSchema.parse(furniture)),
    ).toStrictEqual([]);
  });

  it('floorMaterial: MaterialRef, giữ qua transform', () => {
    expect(RoomSchema.parse({ ...room, floorMaterial: 'library:oak' })).toStrictEqual({
      ...room,
      floorMaterial: 'library:oak',
    });
    for (const bad of [
      'oak',
      'paint:oak',
      'library:Oak',
      'library:',
      `library:${'a'.repeat(65)}`,
      3,
    ]) {
      expect(RoomSchema.safeParse({ ...room, floorMaterial: bad }).success).toBe(false);
    }
  });

  it('paint: đối tượng strict, mặt vắng là vắng khoá', () => {
    expect(WallSchema.parse({ ...wall, paint: { interior: 'scene:white' } })).toStrictEqual({
      ...wall,
      paint: { interior: 'scene:white' },
    });
    expect(WallSchema.parse({ ...wall, paint: {} })).toStrictEqual({ ...wall, paint: {} });
    expect(WallSchema.safeParse({ ...wall, paint: { inside: 'scene:white' } }).success).toBe(false);
    expect(WallSchema.safeParse({ ...wall, paint: { exterior: 'white' } }).success).toBe(false);
  });

  it('detectedThicknessMm (U48): số dương giữ lại, null/vắng là vắng khoá', () => {
    expect(WallSchema.parse({ ...wall, detectedThicknessMm: 221 })).toStrictEqual({ ...wall, detectedThicknessMm: 221 });
    expect('detectedThicknessMm' in WallSchema.parse({ ...wall, detectedThicknessMm: null })).toBe(false);
    expect('detectedThicknessMm' in WallSchema.parse(wall)).toBe(false);
    expect(WallSchema.safeParse({ ...wall, detectedThicknessMm: 0 }).success).toBe(false);
  });

  it('model: id ≤ 120, src đúng mẫu /items/<id>/model.glb', () => {
    expect(FurnitureSchema.parse({ ...furniture, model })).toStrictEqual({ ...furniture, model });
    expect(
      FurnitureSchema.safeParse({ ...furniture, model: { ...model, id: 'x'.repeat(121) } }).success,
    ).toBe(false);
    expect(
      FurnitureSchema.safeParse({ ...furniture, model: { ...model, src: '/x.glb' } }).success,
    ).toBe(false);
    expect(FurnitureSchema.safeParse({ ...furniture, model: { ...model, extra: 1 } }).success).toBe(
      false,
    );
  });

  it('slots: khoá ^[a-z][a-z0-9_]{0,23}$, giá trị MaterialRef, tối đa 8', () => {
    expect(FurnitureSchema.parse({ ...furniture, slots })).toStrictEqual({ ...furniture, slots });
    const eight = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`s${i}`, 'library:oak']));
    expect(FurnitureSchema.safeParse({ ...furniture, slots: eight }).success).toBe(true);
    expect(
      FurnitureSchema.safeParse({ ...furniture, slots: { ...eight, s8: 'library:oak' } }).success,
    ).toBe(false);
    expect(
      FurnitureSchema.safeParse({ ...furniture, slots: { Body: 'library:oak' } }).success,
    ).toBe(false);
    expect(FurnitureSchema.safeParse({ ...furniture, slots: { body: 'oak' } }).success).toBe(false);
  });

  it('đi qua kho nguyên vẹn (normalize → denormalize)', () => {
    const [firstWall, ...walls] = SAMPLE_BUILDING.walls;
    const [firstRoom, ...rooms] = SAMPLE_BUILDING.rooms;
    const [firstItem, ...items] = SAMPLE_BUILDING.furniture;
    if (firstWall === undefined || firstRoom === undefined || firstItem === undefined) {
      throw new Error('bộ mẫu thiếu tường/phòng/đồ đạc');
    }
    const graph = {
      ...SAMPLE_BUILDING,
      furniture: [{ ...firstItem, model, slots }, ...items],
      rooms: [{ ...firstRoom, floorMaterial: 'library:oak' as const }, ...rooms],
      walls: [{ ...firstWall, paint: { exterior: 'library:brick' as const } }, ...walls],
    };

    expect(denormalizeSpatial(normalizeSpatial(graph))).toStrictEqual(graph);
  });
});
