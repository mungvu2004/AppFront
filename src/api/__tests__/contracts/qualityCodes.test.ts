import { describe, expect, it } from 'vitest';

import {
  IMAGE_QUALITY_FINDING_CODES,
  ImageQualityFindingCodeSchema,
  ImageQualityFindingSchema,
} from '../../schemas/quality';

/**
 * §7.4 — năm mã chất lượng ảnh.
 *
 * Hai bài kiểm ở đây kéo về hai hướng ngược nhau, và cả hai đều cố ý:
 *
 * - `ImageQualityFindingCodeSchema` **siết** đúng năm mã, để H1 bắt được một
 *   máy chủ gửi mã thứ sáu mà chưa ai bàn;
 * - `ImageQualityFindingSchema.code` **không** siết, để chính mã thứ sáu ấy
 *   vẫn hiện được trên màn thay vì làm rỗng cả lượt đọc chất lượng (A11).
 *
 * Bài kiểm cuối ghim đúng chỗ đó lại — nếu không, "siết cho nhất quán" là một
 * thay đổi trông rất hợp lý.
 */

const findingBase = {
  id: 'finding-1',
  region: { heightRatio: 0.2, widthRatio: 0.4, xRatio: 0.1, yRatio: 0.05 },
  severity: 'attention',
} as const;

describe('IMAGE_QUALITY_FINDING_CODES', () => {
  it('là đúng năm mã của useInputQualityGate.ts:275-351', () => {
    expect(IMAGE_QUALITY_FINDING_CODES).toStrictEqual([
      'RESOLUTION_TOO_LOW',
      'SKEW_DETECTED',
      'FRAME_NOT_FOUND',
      'LOW_CONTRAST',
      'HIGH_NOISE',
    ]);
  });
});

describe('ImageQualityFindingCodeSchema', () => {
  it.each(IMAGE_QUALITY_FINDING_CODES)('nhận mã %s', (code) => {
    expect(ImageQualityFindingCodeSchema.parse(code)).toBe(code);
  });

  it.each([
    ['mã ngoài tập', 'BLUR_DETECTED'],
    ['chữ thường', 'skew_detected'],
    ['rỗng', ''],
  ])('từ chối %s', (_label, code) => {
    expect(ImageQualityFindingCodeSchema.safeParse(code).success).toBe(false);
  });

  it('không áp dụng: enum không phải object, nên không có khoá lạ hay trường tuỳ chọn', () => {
    expect(ImageQualityFindingCodeSchema.safeParse('HIGH_NOISE').success).toBe(true);
  });

  it('không có refine', () => {
    expect(ImageQualityFindingCodeSchema.safeParse('LOW_CONTRAST').success).toBe(true);
  });
});

describe('ImageQualityFindingSchema giữ nguyên hành vi cũ', () => {
  it.each(IMAGE_QUALITY_FINDING_CODES)('vẫn nhận mã %s', (code) => {
    expect(ImageQualityFindingSchema.safeParse({ ...findingBase, code }).success).toBe(true);
  });

  it('VẪN nhận một mã thứ sáu — A11: một phát hiện lạ không được làm rỗng cả màn', () => {
    expect(
      ImageQualityFindingSchema.safeParse({ ...findingBase, code: 'BLUR_DETECTED' }).success,
    ).toBe(true);
  });

  it('vẫn từ chối mã rỗng', () => {
    expect(ImageQualityFindingSchema.safeParse({ ...findingBase, code: '' }).success).toBe(false);
  });
});
