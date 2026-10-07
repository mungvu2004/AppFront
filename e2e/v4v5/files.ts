/**
 * Dùng chung cho bài nhóm V4 + V5.
 *
 * Tệp mẫu sinh tại chỗ bằng `Buffer` (Q9 = A, `questions.md`): `validateUploadFile`
 * chỉ xét đuôi + kích thước, riêng PDF đọc byte — `%PDF-` ở đầu, rồi đếm
 * `/Type /Page` (`src/lib/upload/validate.ts`). Không commit tệp bản vẽ thật nào.
 */

export const PROJECT_ID = 'project-1';

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts` dùng. */
export const FIRST_PAINT_TIMEOUT_MS = 15_000;

export interface SampleFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

export function pngFile(name: string): SampleFile {
  return { name, mimeType: 'image/png', buffer: Buffer.from('x') };
}

/** PDF tối thiểu có `pages` trang — đủ cho bộ đếm trang của `validate.ts`. */
export function pdfFile(name: string, pages: number): SampleFile {
  const body = 'i 0 obj\n<< /Type /Page >>\nendobj\n'.repeat(pages);

  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(`%PDF-1.4\n${body}trailer\n%%EOF`),
  };
}
