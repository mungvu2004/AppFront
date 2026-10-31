/**
 * U51 — bảng "Tệp đã xuất" giữ qua lượt tải lại trang: chỉ lưu thông tin tệp (không lưu
 * nội dung) theo từng dự án trong `localStorage`, 20 tệp gần nhất. Mọi lần đọc/ghi bọc
 * try/catch: trình duyệt chặn bộ nhớ thì bảng chỉ còn tệp của phiên này, không vỡ màn.
 */
import type { ExportFormatId } from './types';

export interface StoredExportEntry {
  readonly id: string;
  readonly fileName: string;
  readonly byteLength: number;
  readonly formatId: ExportFormatId;
  readonly exportedAtMs: number;
}

export const EXPORT_HISTORY_LIMIT = 20;

const storageKey = (projectId: string): string => `appfront.export-history.${projectId}`;

const isEntry = (value: unknown): value is StoredExportEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['id'] === 'string' &&
    typeof entry['fileName'] === 'string' &&
    typeof entry['byteLength'] === 'number' &&
    typeof entry['formatId'] === 'string' &&
    typeof entry['exportedAtMs'] === 'number'
  );
};

export function readExportHistory(projectId: string): readonly StoredExportEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, EXPORT_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Tệp của phiên này trước, rồi tệp đã lưu chưa có trong phiên; mới nhất trước, tối đa 20. */
export function mergeExportHistory(
  session: readonly StoredExportEntry[],
  stored: readonly StoredExportEntry[],
): readonly StoredExportEntry[] {
  const sessionIds = new Set(session.map((entry) => entry.id));
  return [...session, ...stored.filter((entry) => !sessionIds.has(entry.id))]
    .sort((a, b) => b.exportedAtMs - a.exportedAtMs)
    .slice(0, EXPORT_HISTORY_LIMIT);
}

export function writeExportHistory(projectId: string, entries: readonly StoredExportEntry[]): void {
  try {
    const metadata = entries.slice(0, EXPORT_HISTORY_LIMIT).map(({ id, fileName, byteLength, formatId, exportedAtMs }) => ({
      id,
      fileName,
      byteLength,
      formatId,
      exportedAtMs,
    }));
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(metadata));
  } catch {
    // Bộ nhớ đầy hoặc bị chặn: bảng vẫn có tệp của phiên này.
  }
}
