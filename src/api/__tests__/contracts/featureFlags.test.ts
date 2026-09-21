import { describe, expect, it } from 'vitest';

import { FEATURE_FLAG_KEYS } from '@/lib/telemetry/flags';

import { FeatureFlagsSchema } from '../../schemas/featureFlags';

/**
 * #9 — bảng cờ tính năng.
 *
 * Schema này cố ý không có nơi gọi lúc chạy (`lib/telemetry/flags.ts:60-72`
 * đọc bảng cờ mà không giải mã, để `zod` khỏi lên trang đầu), nên **file này
 * là một trong hai chỗ duy nhất nó được dùng** — chỗ kia là runner đối chiếu
 * golden của backend. Bài kiểm so năm khoá với `FEATURE_FLAG_KEYS` vì thế
 * không phải thủ tục: không có nó, hai danh sách trôi khỏi nhau mà không cổng
 * nào đỏ.
 */

const allFlags = {
  'export.pdf-vector': false,
  'qc.live-collaboration': false,
  'rules.parallel-run': true,
  'scene.instanced-walls': true,
  'scene.soft-shadows': false,
} as const;

describe('FeatureFlagsSchema', () => {
  it('nhận bảng đầy đủ năm cờ', () => {
    expect(FeatureFlagsSchema.parse(allFlags)).toStrictEqual({ ...allFlags });
  });

  it('nhận bảng rỗng và bỏ hẳn cả năm khoá — vắng là "theo mặc định của client"', () => {
    expect(FeatureFlagsSchema.parse({})).toStrictEqual({});
  });

  it.each(FEATURE_FLAG_KEYS)('nhận bảng chỉ mang một cờ: %s', (key) => {
    expect(FeatureFlagsSchema.parse({ [key]: true })).toStrictEqual({ [key]: true });
  });

  it('khai đúng năm khoá mà lib/telemetry/flags.ts:74 liệt kê', () => {
    expect(FEATURE_FLAG_KEYS).toHaveLength(5);
    expect(FeatureFlagsSchema.parse(allFlags)).toStrictEqual(
      Object.fromEntries(FEATURE_FLAG_KEYS.map((key) => [key, allFlags[key]])),
    );
  });

  it('từ chối khoá lạ — một cái tên gõ sai không được lặng lẽ thành "chưa bật"', () => {
    expect(FeatureFlagsSchema.safeParse({ 'scene.instanced_walls': true }).success).toBe(false);
  });

  it.each(FEATURE_FLAG_KEYS)('từ chối null ở trường tuỳ chọn %s', (key) => {
    expect(FeatureFlagsSchema.safeParse({ [key]: null }).success).toBe(false);
  });

  it.each([
    ['chuỗi', 'true'],
    ['số', 1],
    ['object', {}],
  ])('từ chối giá trị %s — cờ là boolean, không phải thứ ép kiểu được', (_label, value) => {
    expect(FeatureFlagsSchema.safeParse({ 'rules.parallel-run': value }).success).toBe(false);
  });

  it('không có refine — không cờ nào phụ thuộc cờ nào', () => {
    expect(FeatureFlagsSchema.safeParse(allFlags).success).toBe(true);
  });
});
