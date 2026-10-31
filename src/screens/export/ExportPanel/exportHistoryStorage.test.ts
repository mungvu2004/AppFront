/** U51 — bảng "Tệp đã xuất" giữ thông tin tệp qua lượt tải lại trang. */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EXPORT_HISTORY_LIMIT, mergeExportHistory, readExportHistory, writeExportHistory } from './exportHistoryStorage';

const entry = (id: string, exportedAtMs: number) => ({
  id,
  fileName: `${id}.glb`,
  byteLength: 10,
  formatId: 'glb' as const,
  exportedAtMs,
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('exportHistoryStorage', () => {
  it('ghi rồi đọc lại đúng thông tin, không lưu nội dung tệp', () => {
    writeExportHistory('P-1', [{ ...entry('a', 1), blob: new Blob(['x']) } as never]);
    expect(readExportHistory('P-1')).toEqual([entry('a', 1)]);
    expect(window.localStorage.getItem('appfront.export-history.P-1')).not.toContain('blob');
    expect(readExportHistory('P-2')).toEqual([]);
  });

  it('gộp: tệp mới nhất trước, không trùng, tối đa 20', () => {
    const stored = Array.from({ length: 25 }, (_unused, index) => entry(`s${index}`, index));
    const merged = mergeExportHistory([entry('s3', 3), entry('new', 100)], stored);
    expect(merged).toHaveLength(EXPORT_HISTORY_LIMIT);
    expect(merged[0]?.id).toBe('new');
    expect(merged.filter((item) => item.id === 's3')).toHaveLength(0);
  });

  it('bộ nhớ hỏng hoặc bị chặn: trả rỗng, không ném lỗi', () => {
    window.localStorage.setItem('appfront.export-history.P-1', '{oops');
    expect(readExportHistory('P-1')).toEqual([]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => writeExportHistory('P-1', [entry('a', 1)])).not.toThrow();
  });
});
