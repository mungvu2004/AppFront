import type { PipelineRun } from '@/api/schemas/pipelineRuns';

/**
 * U09 — ước lượng "thường mất bao lâu" cho lúc chờ AI, để màn không đứng yên mà không nói gì.
 *
 * Nguồn: trung vị thời lượng các lượt đã xong của dự án (N7b, màn đã đọc sẵn). Chưa có lượt
 * nào xong thì đoán theo cỡ ảnh. Không đếm ngược: quá ước lượng thì nói thẳng là lâu hơn thường lệ.
 */

const MS_PER_MINUTE = 60_000;

/** Mốc đoán theo cỡ ảnh khi dự án chưa có lượt nào xong: < 2 MP 1 phút, < 8 MP 2 phút, còn lại 4 phút. */
export function minutesForMegapixels(megapixels: number): number {
  if (megapixels < 2) return 1;
  if (megapixels < 8) return 2;
  return 4;
}

/** Trung vị thời lượng (phút, làm tròn lên, ít nhất 1) của các lượt `completed`; không có thì `null`. */
export function medianRunMinutes(runs: readonly PipelineRun[]): number | null {
  const durations = runs
    .filter((run) => run.status === 'completed' && run.endedAt !== undefined)
    .map((run) => Date.parse(run.endedAt ?? '') - Date.parse(run.startedAt ?? run.createdAt))
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((left, right) => left - right);
  if (durations.length === 0) return null;

  const middle = Math.floor(durations.length / 2);
  const median =
    durations.length % 2 === 1 ? durations[middle] ?? 0 : ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2;
  return Math.max(1, Math.ceil(median / MS_PER_MINUTE));
}

/** Số phút thường mất: lịch sử trước, cỡ ảnh sau; không biết cả hai thì `null`. */
export function typicalRunMinutes(runs: readonly PipelineRun[], megapixels: number | null): number | null {
  return medianRunMinutes(runs) ?? (megapixels === null ? null : minutesForMegapixels(megapixels));
}

/** Câu ước lượng; đã chờ quá ước lượng thì không đếm âm mà báo vẫn đang chạy. */
export function estimateSentence(minutes: number, elapsedMs: number): string {
  return elapsedMs > minutes * MS_PER_MINUTE
    ? 'Lâu hơn thường lệ, vẫn đang chạy.'
    : `Thường mất khoảng ${minutes} phút.`;
}
