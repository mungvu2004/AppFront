import { describe, expect, it } from 'vitest';

import type { PipelineRun } from '@/api/schemas/pipelineRuns';

import { estimateSentence, medianRunMinutes, minutesForMegapixels, typicalRunMinutes } from './processingEstimate';

const run = (status: PipelineRun['status'], minutes: number | null): PipelineRun => ({
  createdAt: '2026-10-31T10:00:00Z',
  startedAt: '2026-10-31T10:00:00Z',
  ...(minutes === null ? {} : { endedAt: new Date(Date.parse('2026-10-31T10:00:00Z') + minutes * 60_000).toISOString() }),
  floorId: 'f1',
  floorName: 'Tầng 1',
  progressPercent: status === 'completed' ? 100 : 0,
  runId: `r-${status}-${minutes}`,
  status,
  step: 'preprocess',
  updatedAt: '2026-10-31T10:00:00Z',
  uploadId: 'u1',
});

describe('processingEstimate (U09)', () => {
  it('trung vị các lượt đã xong, làm tròn lên phút; bỏ lượt lỗi hoặc đang chạy', () => {
    expect(medianRunMinutes([run('completed', 1.2), run('completed', 3), run('completed', 10), run('failed', 50)])).toBe(3);
    expect(medianRunMinutes([run('completed', 1), run('completed', 2.5)])).toBe(2);
    expect(medianRunMinutes([run('running', null), run('failed', 4)])).toBeNull();
  });

  it('chưa có lượt nào xong thì đoán theo cỡ ảnh, không biết cỡ thì null', () => {
    expect(minutesForMegapixels(1.9)).toBe(1);
    expect(minutesForMegapixels(5)).toBe(2);
    expect(minutesForMegapixels(12)).toBe(4);
    expect(typicalRunMinutes([], 12)).toBe(4);
    expect(typicalRunMinutes([], null)).toBeNull();
    expect(typicalRunMinutes([run('completed', 2)], 12)).toBe(2);
  });

  it('quá ước lượng thì báo vẫn đang chạy, không đếm âm', () => {
    expect(estimateSentence(2, 60_000)).toBe('Thường mất khoảng 2 phút.');
    expect(estimateSentence(2, 121_000)).toBe('Lâu hơn thường lệ, vẫn đang chạy.');
  });
});
