import { describe, expect, it } from 'vitest';

import { ApiErrorBodySchema } from '@/api/schemas/errors';
import type { HttpError } from '@/lib/http';

import { describeWriteError } from './inputQualityWriteErrors';

const FALLBACK = 'Câu dự phòng.';

/** Lỗi `kind: 'http'` mang thân lỗi dạng dây; thân được kiểm bằng schema thật. */
function httpError(status: number, code: string, extra: Record<string, string> = {}): HttpError {
  const body = { code, requestId: 'req-test-1', ...extra };

  expect(ApiErrorBodySchema.safeParse(body).success).toBe(true);

  return { code, kind: 'http', raw: body, requestId: 'req-test-1', retryable: false, status };
}

const transportError = (kind: 'network' | 'timeout'): HttpError => ({
  kind,
  raw: null,
  requestId: 'req-test-2',
  retryable: true,
});

describe('describeWriteError — bảng câu lỗi ghi', () => {
  it('409 QUALITY_DRAWING_CHANGED: câu riêng, đọc lại', () => {
    expect(describeWriteError(httpError(409, 'QUALITY_DRAWING_CHANGED'), FALLBACK)).toEqual({
      reread: true,
      sentence: 'Bản vẽ của tầng vừa đổi, kết quả đo đã được đọc lại; hãy xem rồi thử lại.',
    });
  });

  it('422 QUALITY_LAYER_REVIEWED: câu chặn, không đọc lại', () => {
    expect(describeWriteError(httpError(422, 'QUALITY_LAYER_REVIEWED'), FALLBACK)).toEqual({
      reread: false,
      sentence:
        'Tầng này đã có tỉ lệ hoặc hình học do người chỉnh, nên không nắn hay cắt lại bản vẽ được nữa.',
    });
  });

  it('422 VALIDATION trên trường corners: bốn góc không hợp lệ', () => {
    expect(
      describeWriteError(httpError(422, 'VALIDATION', { field: 'corners' }), FALLBACK),
    ).toEqual({
      reread: false,
      sentence: 'Bốn góc chưa tạo thành một khung hợp lệ; hãy chọn lại.',
    });
  });

  it('422 VALIDATION trên trường khác corners: rơi về câu dự phòng', () => {
    expect(describeWriteError(httpError(422, 'VALIDATION', { field: 'body' }), FALLBACK)).toEqual({
      reread: false,
      sentence: FALLBACK,
    });
  });

  it('422 IMAGE_TOO_LARGE', () => {
    expect(describeWriteError(httpError(422, 'IMAGE_TOO_LARGE'), FALLBACK)).toEqual({
      reread: false,
      sentence: 'Ảnh bản vẽ lớn hơn mức xử lý được; hãy tải bản vẽ nhỏ hơn.',
    });
  });

  it('422 PDF_UNREADABLE', () => {
    expect(describeWriteError(httpError(422, 'PDF_UNREADABLE'), FALLBACK)).toEqual({
      reread: false,
      sentence: 'Không đọc được trang PDF của bản vẽ; hãy tải lại tệp.',
    });
  });

  it('422 FILE_CORRUPT', () => {
    expect(describeWriteError(httpError(422, 'FILE_CORRUPT'), FALLBACK)).toEqual({
      reread: false,
      sentence: 'Tệp bản vẽ bị hỏng; hãy tải lại tệp.',
    });
  });

  it('503 DEPENDENCY_UNAVAILABLE', () => {
    expect(describeWriteError(httpError(503, 'DEPENDENCY_UNAVAILABLE'), FALLBACK)).toEqual({
      reread: false,
      sentence: 'Hàng xử lý đang đầy; hãy thử lại sau ít phút.',
    });
  });

  it.each(['network', 'timeout'] as const)('lỗi %s: chưa chắc máy chủ đã nhận, đọc lại', (kind) => {
    expect(describeWriteError(transportError(kind), FALLBACK)).toEqual({
      reread: true,
      sentence: 'Chưa chắc máy chủ đã nhận thao tác; kết quả đo đang được đọc lại.',
    });
  });

  it('lỗi bọc trong { error } vẫn đọc được mã', () => {
    expect(
      describeWriteError({ error: httpError(422, 'FILE_CORRUPT') }, FALLBACK).sentence,
    ).toBe('Tệp bản vẽ bị hỏng; hãy tải lại tệp.');
  });

  it('mã lạ: câu dự phòng, không chứa chuỗi dạng A_B', () => {
    const result = describeWriteError(httpError(422, 'SOMETHING_NEW'), FALLBACK);

    expect(result).toEqual({ reread: false, sentence: FALLBACK });
    expect(result.sentence).not.toMatch(/[A-Z]+_[A-Z]+/u);
  });

  it('thứ không phải lỗi dây (chuỗi, null): câu dự phòng', () => {
    expect(describeWriteError('boom', FALLBACK).sentence).toBe(FALLBACK);
    expect(describeWriteError(null, FALLBACK).sentence).toBe(FALLBACK);
  });

  it('không câu nào in mã lỗi', () => {
    const codes = [
      'QUALITY_DRAWING_CHANGED',
      'QUALITY_LAYER_REVIEWED',
      'IMAGE_TOO_LARGE',
      'PDF_UNREADABLE',
      'FILE_CORRUPT',
      'DEPENDENCY_UNAVAILABLE',
    ];

    for (const code of codes) {
      expect(describeWriteError(httpError(422, code), FALLBACK).sentence).not.toMatch(/[A-Z]+_[A-Z]+/u);
    }
  });
});
