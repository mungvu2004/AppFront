import { describe, expect, it } from 'vitest';

import { describeError } from '../describeError';
import { toAppError } from '../toAppError';

const expectVietnamese = (value: string): void => {
  expect(value).toMatch(/[À-ỹĐđ]/u);
  expect(value).not.toMatch(/\b(Error|Failed|Invalid)\b/i);
};

describe('errors/describeError.ts', () => {
  it('returns translated copy for toast, banner, and full-screen states', () => {
    const processing = describeError(
      toAppError(Object.assign(new Error('Worker crashed while processing step 5'), { requestId: 'req-step-5', step: '5' })),
    );
    const geometry = describeError(
      toAppError(Object.assign(new Error('WebGL context lost'), { requestId: 'req-geom', count: 3, floor: '2' })),
    );
    const forbidden = describeError(
      toAppError({
        kind: 'http',
        raw: {},
        requestId: 'req-forbidden',
        retryable: false,
        status: 403,
      }),
    );

    for (const item of [processing, geometry, forbidden]) {
      expectVietnamese(item.title);
      expectVietnamese(item.description);
      expectVietnamese(item.primaryButtonLabel);
      expectVietnamese(item.secondaryButtonLabel);
    }

    expect(processing.description).toContain('bước 5');
    expect(geometry.description).toContain('3 tường');
    expect(geometry.description).toContain('tầng 2');
    expect(forbidden.primaryButtonLabel).toBe('Liên hệ quản trị');
  });

  it('404 không khuyên tải lại — tải lại không đem nội dung đã mất về (QA-01 nợ #7)', () => {
    const notFound = describeError(
      toAppError({ kind: 'http', raw: {}, requestId: 'req-404', retryable: false, status: 404 }),
    );

    expect(notFound.description).not.toMatch(/tải lại/i);
    expect(notFound.primaryButtonLabel).not.toBe('Tải lại');
  });
});
