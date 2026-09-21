import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  PROJECT_SUMMARY_STATUSES,
  ProjectSummaryMemberSchema,
  ProjectSummaryPageSchema,
  ProjectSummarySchema,
} from '../../schemas/projectSummaries';

/**
 * N1 — thẻ dự án của dashboard (HOP-DONG-MOI §2).
 *
 * Mỗi refine được thử bằng một mẫu **chỉ** vi phạm đúng điều kiện ấy, và phép
 * kiểm đòi đúng **một** issue ở đúng `path` — nên một luật khác lỡ bắn theo
 * cũng làm đỏ test.
 */

const ULID = '01J9ZQK7X4N2M8P6R3T5V7W9Y1';
const PRJ = `prj_${ULID}`;
const USR = `usr_${ULID}`;
const UPDATED = '2026-09-21T03:00:00.123Z';

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

/** Bản sao của `source` thiếu đúng một khoá. */
function without(source: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
}

/**
 * Hai dạng "không có" của một trường: vắng hẳn khoá, và khoá mang `undefined`.
 * zod 3 bỏ khoá vắng nhưng GIỮ khoá mang `undefined`, nên luật kiểm sự có mặt
 * phải qua cả hai.
 */
function missing(source: object, key: string): [string, Record<string, unknown>][] {
  return [
    ['vắng khoá', without(source, key)],
    ['khoá mang undefined', { ...source, [key]: undefined }],
  ];
}

/** Bỏ riêng từng khoá bắt buộc thì hỏng đúng ở khoá đó. */
function itRequiresKeys(schema: z.ZodTypeAny, sample: object, keys: string[]): void {
  it.each(keys)('từ chối thiếu khoá bắt buộc %s', (key) => {
    expect(issuePaths(schema, without(sample, key))).toStrictEqual([[key]]);
  });
}

function accepts(schema: z.ZodTypeAny, input: unknown): boolean {
  return schema.safeParse(input).success;
}

const member = { id: USR, name: 'Phạm An' };

/** Đang QC: có tầng, còn tường chưa duyệt, có tầng mở mặc định. Mẫu đầy đủ. */
const qcSummary = {
  areaM2: 238,
  defaultFloorId: 'L1',
  floorCount: 4,
  id: PRJ,
  members: [member],
  name: 'Nhà phố Thảo Điền',
  status: 'qc',
  updatedAt: UPDATED,
  wallsReviewedCount: 12,
  wallsTotalCount: 48,
};

/** Vừa tạo: 0 tầng, không có `defaultFloorId`, không thành viên. Mẫu tối thiểu. */
const emptySummary = {
  areaM2: 0,
  floorCount: 0,
  id: PRJ,
  members: [],
  name: 'Dự án mới',
  status: 'processing',
  updatedAt: UPDATED,
  wallsReviewedCount: 0,
  wallsTotalCount: 0,
};

/** Đang xử lý nhưng đã có tầng — nên có `defaultFloorId`. */
const processingSummary = { ...qcSummary, status: 'processing' };

const doneSummary = { ...qcSummary, status: 'done', wallsReviewedCount: 48 };

describe('PROJECT_SUMMARY_STATUSES', () => {
  it('đúng ba trạng thái của HOP-DONG-MOI §2, cùng thứ tự', () => {
    expect([...PROJECT_SUMMARY_STATUSES]).toStrictEqual(['processing', 'qc', 'done']);
  });
});

describe('ProjectSummaryMemberSchema', () => {
  // Không có trường tuỳ chọn nào, nên ca "null ở trường tuỳ chọn" không áp dụng.

  it('nhận mẫu đầy đủ (cũng là tối thiểu: hai trường đều bắt buộc)', () => {
    expect(ProjectSummaryMemberSchema.parse(member)).toStrictEqual(member);
  });

  itRequiresKeys(ProjectSummaryMemberSchema, member, ['id', 'name']);

  it('từ chối khoá lạ initials', () => {
    expect(issuePaths(ProjectSummaryMemberSchema, { ...member, initials: 'PA' })).toStrictEqual([
      [],
    ]);
  });

  it.each([
    ['id sai tiền tố', { id: PRJ }, 'id'],
    ['id kiểu mock cũ', { id: 'user-1' }, 'id'],
    ['tên rỗng', { name: '' }, 'name'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(ProjectSummaryMemberSchema, { ...member, ...patch })).toStrictEqual([[key]]);
  });
});

describe('ProjectSummarySchema', () => {
  it('nhận mẫu đầy đủ (qc)', () => {
    expect(ProjectSummarySchema.parse(qcSummary)).toStrictEqual(qcSummary);
  });

  it('nhận mẫu tối thiểu (processing, 0 tầng, không defaultFloorId)', () => {
    expect(ProjectSummarySchema.parse(emptySummary)).toStrictEqual(emptySummary);
  });

  it('nhận processing đã có tầng', () => {
    expect(ProjectSummarySchema.parse(processingSummary)).toStrictEqual(processingSummary);
  });

  it('nhận done: đã duyệt đủ mọi tường', () => {
    expect(ProjectSummarySchema.parse(doneSummary)).toStrictEqual(doneSummary);
  });

  it('bỏ hẳn khoá defaultFloorId mang undefined khỏi đầu ra (nhánh floorCount 0)', () => {
    expect(
      ProjectSummarySchema.parse({ ...emptySummary, defaultFloorId: undefined }),
    ).toStrictEqual(emptySummary);
  });

  itRequiresKeys(ProjectSummarySchema, qcSummary, [
    'areaM2',
    'floorCount',
    'id',
    'members',
    'name',
    'status',
    'updatedAt',
    'wallsReviewedCount',
    'wallsTotalCount',
  ]);

  it('từ chối khoá lạ planVariant', () => {
    expect(issuePaths(ProjectSummarySchema, { ...qcSummary, planVariant: 2 })).toStrictEqual([[]]);
  });

  it('từ chối khoá lạ trong members[0]', () => {
    expect(
      issuePaths(ProjectSummarySchema, { ...qcSummary, members: [{ ...member, email: 'a@b.vn' }] }),
    ).toStrictEqual([['members', 0]]);
  });

  it('từ chối null ở defaultFloorId', () => {
    expect(issuePaths(ProjectSummarySchema, { ...qcSummary, defaultFloorId: null })).toStrictEqual([
      ['defaultFloorId'],
    ]);
  });

  it.each([
    ['trạng thái ngoài tập', { status: 'approved' }, ['status']],
    ['tên 2 ký tự', { name: 'Ab' }, ['name']],
    ['tên 81 ký tự', { name: 'a'.repeat(81) }, ['name']],
    ['id sai tiền tố', { id: USR }, ['id']],
    ['id kiểu mock cũ', { id: 'project-1' }, ['id']],
    ['id ULID chữ thường', { id: `prj_${ULID.toLowerCase()}` }, ['id']],
    ['defaultFloorId rỗng', { defaultFloorId: '' }, ['defaultFloorId']],
    ['floorCount âm', { floorCount: -1 }, ['floorCount']],
    ['floorCount thập phân', { floorCount: 1.5 }, ['floorCount']],
    ['areaM2 âm', { areaM2: -0.01 }, ['areaM2']],
    ['wallsTotalCount thập phân', { wallsTotalCount: 48.5 }, ['wallsTotalCount']],
    ['wallsReviewedCount âm', { wallsReviewedCount: -1 }, ['wallsReviewedCount']],
    [
      'updatedAt lệch múi giờ +07:00',
      { updatedAt: '2026-09-21T10:00:00.123+07:00' },
      ['updatedAt'],
    ],
    ['updatedAt thiếu mili giây', { updatedAt: '2026-09-21T03:00:00Z' }, ['updatedAt']],
  ])('từ chối %s', (_label, patch, path) => {
    expect(issuePaths(ProjectSummarySchema, { ...qcSummary, ...patch })).toStrictEqual([path]);
  });

  it('nhận tên đúng 3 và đúng 80 ký tự, updatedAt dạng .123Z', () => {
    expect(accepts(ProjectSummarySchema, { ...qcSummary, name: 'Abc' })).toBe(true);
    expect(accepts(ProjectSummarySchema, { ...qcSummary, name: 'a'.repeat(80) })).toBe(true);
    expect(ProjectSummarySchema.parse(qcSummary).updatedAt).toBe('2026-09-21T03:00:00.123Z');
  });

  /*
   * Bản nhận không kiểm "đã trim" và không tự cắt — lý do (U+FEFF, HOP-DONG-MOI
   * §0.2 B) ở docblock của `projectNameSchema`.
   */
  it.each([
    ['còn dấu cách đầu', ' Nhà A'],
    ['còn dấu cách cuối', 'Nhà A '],
    ['toàn dấu cách, dài 3 — bản nhận không kiểm trim', '   '],
  ])('nhận tên %s, đầu ra giữ nguyên chuỗi', (_label, name) => {
    expect(ProjectSummarySchema.parse({ ...qcSummary, name })).toStrictEqual({
      ...qcSummary,
      name,
    });
  });

  it('nhận defaultFloorId không theo mẫu ULID', () => {
    expect(accepts(ProjectSummarySchema, { ...qcSummary, defaultFloorId: 'tang-2' })).toBe(true);
  });

  it('nhận areaM2 có ba chữ số thập phân (làm tròn là H1 ngữ cảnh)', () => {
    expect(accepts(ProjectSummarySchema, { ...qcSummary, areaM2: 238.123 })).toBe(true);
  });

  describe('refine: wallsReviewedCount ≤ wallsTotalCount', () => {
    it('nhận bằng nhau khi đang qc', () => {
      expect(accepts(ProjectSummarySchema, { ...qcSummary, wallsReviewedCount: 48 })).toBe(true);
    });

    it('duyệt nhiều hơn tổng → path wallsReviewedCount', () => {
      expect(
        issuePaths(ProjectSummarySchema, { ...qcSummary, wallsReviewedCount: 49 }),
      ).toStrictEqual([['wallsReviewedCount']]);
    });
  });

  describe('refine: done ⇒ wallsTotalCount > 0 và duyệt đủ', () => {
    it('done còn tường chưa duyệt → path status', () => {
      expect(
        issuePaths(ProjectSummarySchema, { ...doneSummary, wallsReviewedCount: 47 }),
      ).toStrictEqual([['status']]);
    });

    it('done với 0 tường → path status', () => {
      expect(
        issuePaths(ProjectSummarySchema, {
          ...doneSummary,
          wallsReviewedCount: 0,
          wallsTotalCount: 0,
        }),
      ).toStrictEqual([['status']]);
    });

    it('processing với 0 tường đạt', () => {
      expect(
        accepts(ProjectSummarySchema, {
          ...processingSummary,
          wallsReviewedCount: 0,
          wallsTotalCount: 0,
        }),
      ).toBe(true);
    });
  });

  describe('refine: floorCount === 0 ⇔ vắng defaultFloorId', () => {
    it.each(missing(processingSummary, 'defaultFloorId'))(
      'có tầng mà thiếu defaultFloorId (%s) → path defaultFloorId',
      (_form, body) => {
        expect(issuePaths(ProjectSummarySchema, body)).toStrictEqual([['defaultFloorId']]);
      },
    );

    it('0 tầng mà có defaultFloorId → path defaultFloorId', () => {
      expect(
        issuePaths(ProjectSummarySchema, { ...emptySummary, defaultFloorId: 'L1' }),
      ).toStrictEqual([['defaultFloorId']]);
    });
  });

  describe('refine: qc ⇒ có defaultFloorId', () => {
    it.each([
      ['vắng khoá', { ...emptySummary, status: 'qc' }],
      ['khoá mang undefined', { ...emptySummary, defaultFloorId: undefined, status: 'qc' }],
    ])('qc, 0 tầng, không defaultFloorId (%s) → path defaultFloorId', (_form, body) => {
      expect(issuePaths(ProjectSummarySchema, body)).toStrictEqual([['defaultFloorId']]);
    });
  });
});

describe('ProjectSummaryPageSchema', () => {
  it('nhận trang đầy đủ', () => {
    expect(
      ProjectSummaryPageSchema.parse({
        items: [qcSummary, emptySummary],
        nextCursor: 'eyJpZCI6MX0',
      }),
    ).toStrictEqual({ items: [qcSummary, emptySummary], nextCursor: 'eyJpZCI6MX0' });
  });

  it('nhận trang tối thiểu, không có nextCursor', () => {
    expect(ProjectSummaryPageSchema.parse({ items: [] })).toStrictEqual({ items: [] });
  });

  it('từ chối thiếu items', () => {
    expect(issuePaths(ProjectSummaryPageSchema, {})).toStrictEqual([['items']]);
  });

  it('từ chối khoá lạ và null ở nextCursor', () => {
    expect(accepts(ProjectSummaryPageSchema, { items: [], total: 0 })).toBe(false);
    expect(accepts(ProjectSummaryPageSchema, { items: [], nextCursor: null })).toBe(false);
  });

  it('áp schema của mục cho từng phần tử', () => {
    expect(
      issuePaths(ProjectSummaryPageSchema, { items: [{ ...qcSummary, wallsReviewedCount: 49 }] }),
    ).toStrictEqual([['items', 0, 'wallsReviewedCount']]);
  });
});
