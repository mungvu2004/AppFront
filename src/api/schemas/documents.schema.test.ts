/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { MOCK_DOCUMENT_03 } from '../__mocks__/client';
import {
  ConfirmRegionsResponseSchema,
  DocumentListSchema,
  DocumentSchema,
  PutRegionsResponseSchema,
} from './documents';
import { ApiErrorBodySchema } from './errors';

const page = MOCK_DOCUMENT_03.pages[0]!;
const region = page.regions[0]!;

describe('documents schema (N39–N43)', () => {
  it('giải được tài liệu mẫu 03: 1 trang, 3 vùng (2 mặt bằng + 1 khác)', () => {
    const parsed = DocumentSchema.parse(MOCK_DOCUMENT_03);

    expect(parsed.pages).toHaveLength(1);
    expect(parsed.pages[0]!.regions.map((r) => r.drawingType)).toEqual(['floorPlan', 'floorPlan', 'other']);
  });

  it('từ chối drawingType lạ', () => {
    const bad = { ...MOCK_DOCUMENT_03, pages: [{ ...page, regions: [{ ...region, drawingType: 'roof' }] }] };

    expect(DocumentSchema.safeParse(bad).success).toBe(false);
  });

  it('từ chối khoá lạ', () => {
    expect(DocumentSchema.safeParse({ ...MOCK_DOCUMENT_03, extra: 1 }).success).toBe(false);
    expect(
      DocumentListSchema.safeParse({ items: [], nextCursor: 'x' }).success,
    ).toBe(false);
  });

  it('từ chối box ngoài 0..1 hoặc lộn ngược', () => {
    for (const box of [
      { x0: -0.1, y0: 0, x1: 0.5, y1: 0.5 },
      { x0: 0, y0: 0, x1: 1.2, y1: 0.5 },
      { x0: 0.6, y0: 0, x1: 0.5, y1: 0.5 },
    ]) {
      const bad = { ...MOCK_DOCUMENT_03, pages: [{ ...page, regions: [{ ...region, box }] }] };

      expect(DocumentSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('đáp N42 có và không có warnings', () => {
    expect(PutRegionsResponseSchema.safeParse({ ...page, warnings: [] }).success).toBe(true);
    expect(
      PutRegionsResponseSchema.safeParse({
        ...page,
        warnings: [{ code: 'REGION_OVERLAP', regionIds: ['reg_a', 'reg_b'] }],
      }).success,
    ).toBe(true);
    // `warnings` luôn có (CONTRACT §4.4).
    expect(PutRegionsResponseSchema.safeParse(page).success).toBe(false);
  });

  it('đáp N43', () => {
    expect(
      ConfirmRegionsResponseSchema.parse({
        runs: [{ regionId: 'reg_a', floorId: 'lvl_1', uploadId: 'upl_1' }],
      }).runs,
    ).toHaveLength(1);
    expect(ConfirmRegionsResponseSchema.safeParse({ runs: [{ regionId: 'reg_a' }] }).success).toBe(false);
  });

  it('thân lỗi 422 có field', () => {
    const body = ApiErrorBodySchema.parse({ code: 'VALIDATION', field: 'regions.0.box', requestId: 'req_1' });

    expect(body.field).toBe('regions.0.box');
  });
});
