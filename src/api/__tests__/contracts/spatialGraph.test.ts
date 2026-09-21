import { describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';

import {
  FloorRevisionSchema,
  SpatialGraphDocumentSchema,
  SpatialGraphSchema,
} from '../../schemas/spatialGraph';

/**
 * N15 — cả đồ thị của một công trình, kèm `revision` của từng tầng.
 *
 * Đồ thị mẫu ở đây cố tình **nhỏ**: hai tầng, một tường, không gì khác. Một bộ
 * đầy đủ 48 tường không kiểm thêm được điều gì mà `spatialEntities.test.ts`
 * chưa kiểm, và nó sẽ giấu mất thứ file này thật sự nói về — phép so song ánh
 * giữa `levels` và `floorRevisions`.
 */

const AI_REVIEW = { confidence: 0.82, reviewed: false, source: 'ai' } as const;
const HUMAN_REVIEW = { confidence: 1, reviewed: true, source: 'human' } as const;

const levelOf = (index: number) =>
  ({
    ...HUMAN_REVIEW,
    elevationMm: index * 3900,
    heightMm: 3900,
    id: `L-LEVEL0${index}`,
    name: `Tầng ${index}`,
    order: index,
  }) as const;

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

const graph = {
  axes: [],
  building: {
    ...HUMAN_REVIEW,
    datumElevationMm: 0,
    name: 'Nhà phố Lý Thường Kiệt',
  },
  dimensions: [],
  furniture: [],
  levels: [levelOf(0), levelOf(1)],
  notes: [],
  openings: [],
  rooms: [],
  walls: [wall],
} as const;

const document = {
  floorRevisions: [
    { floorId: 'L-LEVEL00', revision: 7 },
    { floorId: 'L-LEVEL01', revision: 0 },
  ],
  graph,
} as const;

describe('FloorRevisionSchema', () => {
  it('nhận một cặp mã tầng và revision', () => {
    expect(FloorRevisionSchema.parse({ floorId: 'L-LEVEL00', revision: 0 })).toStrictEqual({
      floorId: 'L-LEVEL00',
      revision: 0,
    });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: schema không có trường tuỳ chọn', () => {
    expect(FloorRevisionSchema.safeParse({ floorId: 'L-LEVEL00', revision: 0 }).success).toBe(true);
  });

  it('từ chối khoá lạ', () => {
    expect(
      FloorRevisionSchema.safeParse({ floorId: 'L-LEVEL00', name: 'Tầng trệt', revision: 0 })
        .success,
    ).toBe(false);
  });

  it('từ chối revision âm, thập phân, và mã tầng rỗng', () => {
    expect(FloorRevisionSchema.safeParse({ floorId: 'L-LEVEL00', revision: -1 }).success).toBe(
      false,
    );
    expect(FloorRevisionSchema.safeParse({ floorId: 'L-LEVEL00', revision: 1.5 }).success).toBe(
      false,
    );
    expect(FloorRevisionSchema.safeParse({ floorId: '', revision: 0 }).success).toBe(false);
  });
});

describe('SpatialGraphSchema', () => {
  it('nhận đồ thị đầy đủ chín danh sách', () => {
    expect(SpatialGraphSchema.parse(graph)).toStrictEqual({ ...graph });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: chín khoá đều bắt buộc', () => {
    expect(SpatialGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('từ chối khoá lạ', () => {
    expect(SpatialGraphSchema.safeParse({ ...graph, version: 1 }).success).toBe(false);
  });

  it('từ chối khoá lạ trong một thực thể lồng', () => {
    expect(
      SpatialGraphSchema.safeParse({ ...graph, walls: [{ ...wall, material: 'gạch' }] }).success,
    ).toBe(false);
  });

  it('đòi đủ cả chín khoá, kể cả hai danh sách luôn rỗng ở v1', () => {
    const withoutAxes: Record<string, unknown> = { ...graph };
    delete withoutAxes.axes;

    const withoutNotes: Record<string, unknown> = { ...graph };
    delete withoutNotes.notes;

    expect(SpatialGraphSchema.safeParse(withoutAxes).success).toBe(false);
    expect(SpatialGraphSchema.safeParse(withoutNotes).success).toBe(false);
  });
});

describe('SpatialGraphDocumentSchema', () => {
  it('nhận tài liệu có song ánh giữa levels và floorRevisions', () => {
    expect(SpatialGraphDocumentSchema.parse(document)).toStrictEqual({ ...document });
  });

  it('không áp dụng phép kiểm null-ở-trường-tuỳ-chọn: hai khoá đều bắt buộc', () => {
    expect(SpatialGraphDocumentSchema.safeParse(document).success).toBe(true);
  });

  it('từ chối khoá lạ', () => {
    expect(SpatialGraphDocumentSchema.safeParse({ ...document, projectId: 'prj_1' }).success).toBe(
      false,
    );
  });

  it.each([
    [
      'một tầng có hai dòng revision',
      {
        ...document,
        floorRevisions: [
          { floorId: 'L-LEVEL00', revision: 7 },
          { floorId: 'L-LEVEL00', revision: 8 },
        ],
      },
    ],
    [
      'một tầng xuất hiện hai lần trong levels',
      { ...document, graph: { ...graph, levels: [levelOf(0), levelOf(0)] } },
    ],
    [
      'thiếu một dòng revision',
      { ...document, floorRevisions: [{ floorId: 'L-LEVEL00', revision: 7 }] },
    ],
    [
      'một dòng revision trỏ tới tầng không có trong đồ thị',
      {
        ...document,
        floorRevisions: [
          { floorId: 'L-LEVEL00', revision: 7 },
          { floorId: 'L-LEVEL09', revision: 0 },
        ],
      },
    ],
  ])('refine song ánh hỏng khi %s, và nêu đúng path floorRevisions', (_label, body) => {
    const parsed = SpatialGraphDocumentSchema.safeParse(body);

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues[0]?.path).toStrictEqual(['floorRevisions']);
  });

  it('nhận công trình chưa có tầng nào — hai danh sách rỗng vẫn là song ánh', () => {
    expect(
      SpatialGraphDocumentSchema.safeParse({
        floorRevisions: [],
        graph: { ...graph, levels: [], walls: [] },
      }).success,
    ).toBe(true);
  });
});

/**
 * Bộ mẫu chuẩn A14 **hỏng** hợp đồng mới, và nó hỏng ở đúng một chỗ.
 *
 * `sampleBuilding.ts:200` ghi `createdAt: '2026-08-13T09:00:00+07:00'`, còn
 * hợp đồng mới đòi UTC `Z` ba chữ số (W3). Bài kiểm này ghim lại chỗ lệch ấy để
 * người sửa fixture thấy ngay nó ở đâu — và để không ai "sửa" bằng cách nới
 * `isoInstantSchema`.
 */
describe('Bộ mẫu A14 đối chiếu hợp đồng mới', () => {
  it('hỏng đúng ở notes[0].createdAt vì bộ mẫu dùng +07:00', () => {
    const parsed = SpatialGraphSchema.safeParse(createSampleBuilding());

    expect(parsed.success).toBe(false);
    expect(
      parsed.success
        ? []
        : parsed.error.issues.map((issue) => issue.path.join('.')),
    ).toContain('notes.0.createdAt');
  });
});
