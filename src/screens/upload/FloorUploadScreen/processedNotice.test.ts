import { describe, expect, it } from 'vitest';

import type { Floor } from '@/api/client';
import { processedNoticeOf } from './useFloorUploadScreen';

const floor = (drawings: number, areaM2?: number): Floor =>
  ({ id: `f${drawings}${areaM2 ?? ''}`, drawings: Array.from({ length: drawings }, () => ({})), ...(areaM2 === undefined ? {} : { areaM2 }) }) as unknown as Floor;

describe('processedNoticeOf (UX-07)', () => {
  it('nói số tầng đã xử lý khi có tầng ra kết quả', () => {
    expect(processedNoticeOf([floor(1, 80), floor(1), floor(0)], 0)).toContain('Đã xử lý 1/3 tầng');
  });

  it('im khi chưa tầng nào xử lý hoặc đang thả tệp mới', () => {
    expect(processedNoticeOf([floor(1), floor(0)], 0)).toBeNull();
    expect(processedNoticeOf([floor(1, 80)], 2)).toBeNull();
  });
});
