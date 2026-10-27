// @vitest-environment node
/**
 * Tệp thay `blob-stream` (`../blobStream`): pdfkit THẬT `pipe` vào nó phải ra một tệp PDF.
 *
 * pdfkit lấy đúng bản editor Pascal dùng (`vendor/pascal/packages/editor`), bản Node: `pipe` của
 * `stream` Node đòi cùng bộ phương thức với readable-stream trong bản standalone mà trang 3D nạp
 * (`on`/`once`/`prependListener`/`emit`/`write`/`end`). Đường trình duyệt thật dưới CSP do
 * `e2e/pascal-viewer.spec.ts` kiểm.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import blobStream from '../blobStream';

interface PdfDoc {
  pipe<T>(destination: T): T;
  text(value: string): PdfDoc;
  addPage(): PdfDoc;
  end(): void;
}

const requireFromEditor = createRequire(path.resolve(__dirname, '../../../vendor/pascal/packages/editor/package.json'));
const PDFDocument = requireFromEditor('pdfkit') as new (options?: Record<string, unknown>) => PdfDoc;

describe('blobStream', () => {
  it('nhận pdfkit qua pipe, phát finish, và toBlob ra tệp PDF', async () => {
    const doc = new PDFDocument({ compress: true });
    const stream = doc.pipe(blobStream());
    const finished = new Promise<void>((resolve) => stream.on('finish', () => resolve()));

    doc.text('Mặt bằng tầng 1');
    doc.addPage().text('trang 2');
    doc.end();
    await finished;

    const blob = stream.toBlob('application/pdf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder('latin1').decode(bytes);

    expect(blob.type).toBe('application/pdf');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(stream.length).toBe(bytes.length);
  });

  it('once gỡ mình sau lần phát đầu; prependListener chạy trước', () => {
    const stream = blobStream();
    const calls: string[] = [];
    stream.on('finish', () => calls.push('on'));
    stream.once('finish', () => calls.push('once'));
    stream.prependListener('finish', () => calls.push('first'));

    stream.emit('finish');
    stream.emit('finish');

    expect(calls).toEqual(['first', 'on', 'once', 'first', 'on']);
    expect(stream.listenerCount('finish')).toBe(2);
  });

  it('end phát finish rồi close, và toBlob trả cùng một Blob', () => {
    const stream = blobStream();
    const order: string[] = [];
    stream.on('finish', () => order.push('finish'));
    stream.on('close', () => order.push('close'));

    stream.write(new Uint8Array([1, 2]));
    stream.end(new Uint8Array([3]));

    expect(order).toEqual(['finish', 'close']);
    expect(stream.length).toBe(3);
    expect(stream.toBlob()).toBe(stream.toBlob());
  });
});
