import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  FloorLayerDocumentSchema,
  FloorLayerWriteBodySchema,
  FloorLayerWriteResultSchema,
  FloorLayerWriteSchema,
} from '../../schemas/spatialLayer';

/**
 * N16 và #35 — đọc và ghi lớp không gian của **một** tầng.
 *
 * Hai refine ở đây canh hai lỗi rất khác nhau. Refine của tài liệu canh một
 * mâu thuẫn **trong dữ liệu máy chủ gửi về**: nói "tỉ lệ chưa ai xác nhận" mà
 * lại không có tỉ lệ nào. Refine của thân ghi canh một request **rỗng** mà
 * client sắp gửi đi — nó tiêu một `baseVersion`, sinh một `revision` mới, và
 * không đổi gì.
 */

const AI_REVIEW = { confidence: 0.82, reviewed: false, source: 'ai' } as const;
const HUMAN_REVIEW = { confidence: 1, reviewed: true, source: 'human' } as const;

const wall = {
  ...AI_REVIEW,
  centreline: { end: { x: 4800, y: 0 }, start: { x: 0, y: 0 } },
  heightMm: 3900,
  id: 'W-WALL000',
  kind: 'partition',
  levelId: 'L-LEVEL00',
  openingIds: [],
  thicknessMm: 220,
} as const;

const layer = {
  furniture: [],
  openings: [],
  rooms: [],
  walls: [wall],
} as const;

const calibratedLevel = {
  ...HUMAN_REVIEW,
  elevationMm: 0,
  heightMm: 3900,
  id: 'L-LEVEL00',
  name: 'Tầng trệt',
  order: 0,
  scaleMillimetresPerPixel: 12.5,
} as const;

const uncalibratedLevel = {
  ...HUMAN_REVIEW,
  elevationMm: 0,
  heightMm: 3900,
  id: 'L-LEVEL00',
  name: 'Tầng trệt',
  order: 0,
} as const;

const dimension = {
  ...AI_REVIEW,
  id: 'M-DIMN000',
  kind: 'linear',
  levelId: 'L-LEVEL00',
  line: { end: { x: 4800, y: -500 }, start: { x: 0, y: -500 } },
  referenceIds: ['W-WALL000'],
  valueMm: 4800,
} as const;

const fullDocument = {
  axes: [],
  dimensions: [dimension],
  layer,
  level: calibratedLevel,
  revision: 7,
  scaleStatus: 'unresolved',
} as const;

const minimalDocument = {
  axes: [],
  dimensions: [],
  layer,
  level: uncalibratedLevel,
  revision: 0,
} as const;

describe('FloorLayerDocumentSchema', () => {
  it('nhận tài liệu đầy đủ', () => {
    expect(FloorLayerDocumentSchema.parse(fullDocument)).toStrictEqual({ ...fullDocument });
  });

  it('nhận tài liệu tối thiểu và bỏ hẳn khoá scaleStatus', () => {
    expect(FloorLayerDocumentSchema.parse(minimalDocument)).toStrictEqual({ ...minimalDocument });
  });

  it('từ chối khoá lạ — notes bị bỏ khỏi N16 vì không màn QC nào đọc', () => {
    expect(FloorLayerDocumentSchema.safeParse({ ...minimalDocument, notes: [] }).success).toBe(
      false,
    );
  });

  it('từ chối khoá lạ trong layer lồng', () => {
    expect(
      FloorLayerDocumentSchema.safeParse({
        ...minimalDocument,
        layer: { ...layer, axes: [] },
      }).success,
    ).toBe(false);
  });

  it('từ chối null ở trường tuỳ chọn scaleStatus', () => {
    expect(
      FloorLayerDocumentSchema.safeParse({ ...minimalDocument, scaleStatus: null }).success,
    ).toBe(false);
  });

  it('từ chối scaleStatus ngoài giá trị duy nhất unresolved', () => {
    expect(
      FloorLayerDocumentSchema.safeParse({ ...fullDocument, scaleStatus: 'resolved' }).success,
    ).toBe(false);
  });

  it('từ chối revision âm và revision thập phân', () => {
    expect(FloorLayerDocumentSchema.safeParse({ ...minimalDocument, revision: -1 }).success).toBe(
      false,
    );
    expect(FloorLayerDocumentSchema.safeParse({ ...minimalDocument, revision: 1.5 }).success).toBe(
      false,
    );
  });

  it('refine tỉ lệ: có scaleStatus mà tầng không có tỉ lệ thì hỏng, đúng path', () => {
    const parsed = FloorLayerDocumentSchema.safeParse({
      ...minimalDocument,
      scaleStatus: 'unresolved',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues[0]?.path).toStrictEqual([
      'level',
      'scaleMillimetresPerPixel',
    ]);
  });

  it('refine tỉ lệ: tầng đã hiệu chỉnh, vắng scaleStatus — đạt', () => {
    expect(
      FloorLayerDocumentSchema.safeParse({ ...minimalDocument, level: calibratedLevel }).success,
    ).toBe(true);
  });
});

describe('FloorLayerWriteBodySchema', () => {
  it('nhận thân chỉ mang lớp', () => {
    expect(FloorLayerWriteBodySchema.parse({ layer })).toStrictEqual({ layer });
  });

  it('nhận thân chỉ mang tỉ lệ — đó là cách áp tỉ lệ cho mọi tầng', () => {
    expect(FloorLayerWriteBodySchema.parse({ scaleMillimetresPerPixel: 12.5 })).toStrictEqual({
      scaleMillimetresPerPixel: 12.5,
    });
  });

  it('nhận thân mang cả hai', () => {
    expect(
      FloorLayerWriteBodySchema.parse({ layer, scaleMillimetresPerPixel: 12.5 }),
    ).toStrictEqual({ layer, scaleMillimetresPerPixel: 12.5 });
  });

  it('từ chối khoá lạ', () => {
    expect(FloorLayerWriteBodySchema.safeParse({ layer, force: true }).success).toBe(false);
  });

  it.each([
    ['layer', { layer: null }],
    ['scaleMillimetresPerPixel', { scaleMillimetresPerPixel: null }],
  ])('từ chối null ở trường tuỳ chọn %s', (_label, body) => {
    expect(FloorLayerWriteBodySchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ['0', 0],
    ['âm', -12.5],
    ['vô cực', Number.POSITIVE_INFINITY],
  ])('từ chối tỉ lệ %s', (_label, scaleMillimetresPerPixel) => {
    expect(FloorLayerWriteBodySchema.safeParse({ scaleMillimetresPerPixel }).success).toBe(false);
  });

  it.each([
    ['thân rỗng', {}],
    ['khoá có mặt nhưng mang undefined: layer', { layer: undefined }],
    ['khoá có mặt nhưng mang undefined: tỉ lệ', { scaleMillimetresPerPixel: undefined }],
    ['cả hai khoá mang undefined', { layer: undefined, scaleMillimetresPerPixel: undefined }],
  ])('refine ít nhất một giá trị: %s hỏng, path rỗng', (_label, body) => {
    const parsed = FloorLayerWriteBodySchema.safeParse(body);

    expect(parsed.success).toBe(false);
    expect(parsed.success ? ['chưa hỏng'] : parsed.error.issues[0]?.path).toStrictEqual([]);
  });

  /**
   * Ghim lại chỗ mà phép đếm khoá từng lọt.
   *
   * `zod` 3 giữ khoá có mặt mà mang `undefined`, nên `{ layer: undefined }` có
   * `Object.keys().length === 1` — đủ qua một refine đếm khoá, rồi
   * `JSON.stringify` biến nó thành `{}` trên dây. Bài kiểm này đọc thẳng cái
   * hình dạng ấy để lần sau ai viết lại refine bằng `Object.keys` sẽ thấy đỏ.
   */
  it('khoá mang undefined VẪN có mặt sau khi zod phân tích — nên không được đếm khoá', () => {
    const passthrough = z.object({ layer: z.unknown() }).safeParse({ layer: undefined });

    expect(passthrough.success && Object.keys(passthrough.data)).toStrictEqual(['layer']);
    expect(JSON.stringify({ layer: undefined })).toBe('{}');
  });
});

describe('FloorLayerWriteSchema', () => {
  it('nhận thân ghi có version', () => {
    expect(
      FloorLayerWriteSchema.parse({ baseVersion: 7, body: { scaleMillimetresPerPixel: 12.5 } }),
    ).toStrictEqual({ baseVersion: 7, body: { scaleMillimetresPerPixel: 12.5 } });
  });

  it('gắn tiền tố body vào path của refine thân trong', () => {
    const parsed = FloorLayerWriteSchema.safeParse({ baseVersion: 7, body: {} });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? ['chưa hỏng'] : parsed.error.issues[0]?.path).toStrictEqual(['body']);
  });

  it('từ chối thiếu baseVersion', () => {
    expect(FloorLayerWriteSchema.safeParse({ body: { layer } }).success).toBe(false);
  });

  it('từ chối khoá lạ ở thân ngoài', () => {
    expect(
      FloorLayerWriteSchema.safeParse({ baseVersion: 7, body: { layer }, floorId: 'L-LEVEL00' })
        .success,
    ).toBe(false);
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: hai khoá ngoài đều bắt buộc', () => {
    expect(FloorLayerWriteSchema.safeParse({ baseVersion: 7, body: { layer } }).success).toBe(true);
  });
});

describe('FloorLayerWriteResultSchema', () => {
  it('nhận phản hồi của PUT', () => {
    expect(FloorLayerWriteResultSchema.parse({ layer, revision: 8 })).toStrictEqual({
      layer,
      revision: 8,
    });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: hai khoá đều bắt buộc', () => {
    expect(FloorLayerWriteResultSchema.safeParse({ layer, revision: 8 }).success).toBe(true);
  });

  it('từ chối khoá lạ — level và scaleStatus thuộc đường đọc', () => {
    expect(
      FloorLayerWriteResultSchema.safeParse({ layer, level: calibratedLevel, revision: 8 }).success,
    ).toBe(false);
  });

  it('từ chối revision âm', () => {
    expect(FloorLayerWriteResultSchema.safeParse({ layer, revision: -1 }).success).toBe(false);
  });
});
