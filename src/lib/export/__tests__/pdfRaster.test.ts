import { describe, expect, it } from 'vitest';

import { writeJpegPdf } from '../pdfRaster';

const page = { jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), widthPx: 2, heightPx: 3 };
const latin1 = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('writeJpegPdf (UX-05)', () => {
  it('mở đầu %PDF-1.4, đếm đúng số trang, kết thúc %%EOF', () => {
    const pdf = latin1(writeJpegPdf([page, page]));

    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf).toContain('/Count 2');
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(pdf).toContain('/Filter /DCTDecode /Length 4');
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('mọi hàng xref và startxref trỏ đúng vào đầu đối tượng', () => {
    const pdf = latin1(writeJpegPdf([page]));
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);

    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    const entries = pdf
      .slice(startxref)
      .split('\n')
      .slice(3)
      .filter((line) => line.endsWith(' n '));

    expect(entries).toHaveLength(5);
    entries.forEach((line, index) => {
      const offset = Number(line.slice(0, 10));
      const header = `${String(index + 1)} 0 obj\n`;

      expect(pdf.slice(offset, offset + header.length)).toBe(header);
      expect(line).toHaveLength(19);
    });
  });
});
