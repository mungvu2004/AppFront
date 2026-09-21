import { describe, expect, it } from 'vitest';

import {
  MEASUREMENT_RECORD_MODES,
  MeasurementPointSchema,
  MeasurementRecordSchema,
} from '../../schemas/measurements';

/**
 * #16–#18 — phép đo người dùng ghim lại.
 *
 * Đây là schema **hai chiều** duy nhất của lượt này, nên mỗi bài kiểm ở đây
 * nói về cả hai đường: thứ `GET` trả về và thứ `POST` gửi lên đi qua đúng một
 * bộ luật.
 */

const point = { x: 0, y: 0 } as const;
const elevatedPoint = { x: 4800.25, y: 3600.5, z: 2700.75 } as const;

const fullRecord = {
  id: 'MS-0001',
  mode: 'pointToPoint',
  name: 'Nhịp phòng khách',
  points: [point, elevatedPoint],
  rawValueMm: 6000.125,
} as const;

const areaRecord = {
  id: 'MS-0002',
  mode: 'floorArea',
  name: 'Diện tích phòng khách',
  points: [point, { x: 4800, y: 0 }, { x: 4800, y: 3600 }],
  rawValueMm: 17_280_000,
} as const;

describe('MEASUREMENT_RECORD_MODES', () => {
  it('là đúng bốn chế độ, đúng thứ tự của types/measurement.ts', () => {
    expect(MEASUREMENT_RECORD_MODES).toStrictEqual([
      'pointToPoint',
      'perpendicular',
      'height',
      'floorArea',
    ]);
  });
});

describe('MeasurementPointSchema', () => {
  it('nhận điểm đầy đủ ba trục', () => {
    expect(MeasurementPointSchema.parse(elevatedPoint)).toStrictEqual({ ...elevatedPoint });
  });

  it('nhận điểm phẳng và bỏ hẳn khoá z — vắng là nằm trên cốt nền', () => {
    expect(MeasurementPointSchema.parse(point)).toStrictEqual({ ...point });
  });

  it('từ chối khoá lạ', () => {
    expect(MeasurementPointSchema.safeParse({ ...point, snapped: true }).success).toBe(false);
  });

  it('từ chối null ở trường tuỳ chọn z', () => {
    expect(MeasurementPointSchema.safeParse({ ...point, z: null }).success).toBe(false);
  });

  it('nhận toạ độ thập phân và toạ độ âm — miễn trừ W3 đã ghi', () => {
    expect(MeasurementPointSchema.safeParse({ x: -1234.5678, y: 0.1 }).success).toBe(true);
  });

  it.each([
    ['vô cực', { x: Number.POSITIVE_INFINITY, y: 0 }],
    ['NaN', { x: Number.NaN, y: 0 }],
    ['chuỗi', { x: '0', y: 0 }],
  ])('từ chối toạ độ %s', (_label, body) => {
    expect(MeasurementPointSchema.safeParse(body).success).toBe(false);
  });
});

describe('MeasurementRecordSchema', () => {
  it('nhận bản ghi đầy đủ', () => {
    expect(MeasurementRecordSchema.parse(fullRecord)).toStrictEqual({ ...fullRecord });
  });

  it('nhận bản ghi tối thiểu — hai điểm phẳng, không khoá z nào', () => {
    const minimalRecord = {
      id: 'MS-0001',
      mode: 'height',
      name: 'Cao trần',
      points: [point, { x: 0, y: 3600 }],
      rawValueMm: 0,
    };

    expect(MeasurementRecordSchema.parse(minimalRecord)).toStrictEqual(minimalRecord);
  });

  it('từ chối khoá lạ — valueLabel là chuỗi đã định dạng, A15 cấm lưu', () => {
    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, valueLabel: '6,00 m' }).success).toBe(
      false,
    );
  });

  it('từ chối khoá lạ trong một điểm lồng', () => {
    expect(
      MeasurementRecordSchema.safeParse({
        ...fullRecord,
        points: [point, { ...elevatedPoint, snapped: true }],
      }).success,
    ).toBe(false);
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: năm khoá của bản ghi đều bắt buộc', () => {
    expect(MeasurementRecordSchema.safeParse(fullRecord).success).toBe(true);
  });

  it.each([
    ['ba chữ số', 'MS-001'],
    ['không tiền tố', '0001'],
    ['tiền tố thường', 'ms-0001'],
    ['có chữ trong phần số', 'MS-00O1'],
    ['rỗng', ''],
  ])('từ chối id %s', (_label, id) => {
    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, id }).success).toBe(false);
  });

  it('nhận id dài — trần 15 chữ số là luật của máy chủ, không của schema', () => {
    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, id: 'MS-000000000000001' }).success).toBe(
      true,
    );
  });

  it('từ chối chế độ ngoài bốn giá trị', () => {
    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, mode: 'angle' }).success).toBe(false);
  });

  it('từ chối tên rỗng và giá trị âm', () => {
    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, name: '' }).success).toBe(false);
    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, rawValueMm: -1 }).success).toBe(false);
  });

  it('từ chối giá trị vô cực', () => {
    expect(
      MeasurementRecordSchema.safeParse({ ...fullRecord, rawValueMm: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false);
  });

  it('refine số điểm: diện tích sàn cần ba đỉnh', () => {
    expect(MeasurementRecordSchema.parse(areaRecord)).toStrictEqual({ ...areaRecord });

    const parsed = MeasurementRecordSchema.safeParse({
      ...areaRecord,
      points: [point, { x: 4800, y: 0 }],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues[0]?.path).toStrictEqual(['points']);
  });

  it('refine số điểm: ba chế độ còn lại cần hai điểm', () => {
    const parsed = MeasurementRecordSchema.safeParse({ ...fullRecord, points: [point] });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues[0]?.path).toStrictEqual(['points']);
  });

  it('refine số điểm: chuỗi dài không có trần trên', () => {
    const chain = Array.from({ length: 40 }, (_unused, index) => ({ x: index * 100, y: 0 }));

    expect(MeasurementRecordSchema.safeParse({ ...fullRecord, points: chain }).success).toBe(true);
  });
});
