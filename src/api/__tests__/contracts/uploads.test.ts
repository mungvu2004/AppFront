import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { LatestFloorUploadPageSchema, LatestFloorUploadSchema } from '../../schemas/uploads';

/** N7 — lượt tải mới nhất của từng tầng (HOP-DONG-MOI §2). */

const ULID = '01J9ZQK7X4N2M8P6R3T5V7W9Y1';
const UPL = `upl_${ULID}`;

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

/** Bản sao của `source` thiếu đúng một khoá. */
function without(source: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
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

const fullUpload = {
  floorId: 'L1',
  floorName: 'Tầng 1',
  sourceImageUrl: 'https://cdn.appfront.vn/pages/L1/rectified.png',
  uploadId: UPL,
};

const minimalUpload = { floorId: 'L2', floorName: 'Tầng 2', uploadId: UPL };

describe('LatestFloorUploadSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(LatestFloorUploadSchema.parse(fullUpload)).toStrictEqual(fullUpload);
  });

  it('nhận mẫu tối thiểu, không có sourceImageUrl', () => {
    expect(LatestFloorUploadSchema.parse(minimalUpload)).toStrictEqual(minimalUpload);
  });

  it('bỏ hẳn khoá sourceImageUrl mang undefined khỏi đầu ra', () => {
    expect(
      LatestFloorUploadSchema.parse({ ...minimalUpload, sourceImageUrl: undefined }),
    ).toStrictEqual(minimalUpload);
  });

  itRequiresKeys(LatestFloorUploadSchema, fullUpload, ['floorId', 'floorName', 'uploadId']);

  it('từ chối khoá lạ', () => {
    expect(
      issuePaths(LatestFloorUploadSchema, { ...fullUpload, status: 'complete' }),
    ).toStrictEqual([[]]);
  });

  it('từ chối null ở sourceImageUrl', () => {
    expect(
      issuePaths(LatestFloorUploadSchema, { ...fullUpload, sourceImageUrl: null }),
    ).toStrictEqual([['sourceImageUrl']]);
  });

  it.each([
    ['floorId rỗng', { floorId: '' }, 'floorId'],
    ['floorName rỗng', { floorName: '' }, 'floorName'],
    ['uploadId sai tiền tố', { uploadId: `prj_${ULID}` }, 'uploadId'],
    ['uploadId kiểu mock cũ', { uploadId: 'upload-1' }, 'uploadId'],
    ['uploadId 25 ký tự sau tiền tố', { uploadId: UPL.slice(0, -1) }, 'uploadId'],
    ['sourceImageUrl không phải URL', { sourceImageUrl: 'pages/L1.png' }, 'sourceImageUrl'],
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(LatestFloorUploadSchema, { ...fullUpload, ...patch })).toStrictEqual([[key]]);
  });

  it('nhận floorId không theo mẫu ULID', () => {
    expect(accepts(LatestFloorUploadSchema, { ...fullUpload, floorId: 'tang-ham' })).toBe(true);
  });
});

describe('LatestFloorUploadPageSchema', () => {
  it('nhận trang đầy đủ', () => {
    const page = { items: [fullUpload, minimalUpload], nextCursor: 'eyJpZCI6MX0' };
    expect(LatestFloorUploadPageSchema.parse(page)).toStrictEqual(page);
  });

  it('nhận trang tối thiểu, không có nextCursor', () => {
    expect(LatestFloorUploadPageSchema.parse({ items: [] })).toStrictEqual({ items: [] });
  });

  it('từ chối thiếu items', () => {
    expect(issuePaths(LatestFloorUploadPageSchema, {})).toStrictEqual([['items']]);
  });

  it('từ chối khoá lạ và null ở nextCursor', () => {
    expect(accepts(LatestFloorUploadPageSchema, { items: [], total: 0 })).toBe(false);
    expect(accepts(LatestFloorUploadPageSchema, { items: [], nextCursor: null })).toBe(false);
  });

  it('áp schema của mục cho từng phần tử', () => {
    expect(
      issuePaths(LatestFloorUploadPageSchema, { items: [{ ...fullUpload, floorName: '' }] }),
    ).toStrictEqual([['items', 0, 'floorName']]);
  });
});
