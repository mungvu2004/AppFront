import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  guessFloorFromFileName,
  MAX_PDF_PAGE_COUNT,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  readExtension,
  readPdfPageCount,
  validateUploadFile,
  type UploadCandidate,
} from '../validate';

/** The scan window and its carry-over, mirrored so a boundary can be aimed at. */
const SCAN_WINDOW_BYTES = 256 * 1024;

/** A candidate built from text, which is all a PDF token scan ever reads. */
const candidate = (name: string, text: string, sizeBytes?: number): UploadCandidate => {
  const blob = new Blob([text]);

  return {
    name,
    size: sizeBytes ?? blob.size,
    slice: (start?: number, end?: number): Blob => blob.slice(start, end),
  };
};

/** A PDF whose page tree declares its own total. */
const pdfWithCount = (pages: number): string =>
  `%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count ${String(pages)} /Kids [2 0 R] >>\nendobj\n%%EOF\n`;

/** A PDF with no page tree total, only leaf page objects to be counted. */
const pdfWithPageObjects = (pages: number): string => {
  const objects = Array.from(
    { length: pages },
    (_unused, index) => `${String(index + 2)} 0 obj\n<< /Type /Page /Parent 1 0 R >>\nendobj\n`,
  ).join('');

  return `%PDF-1.5\n1 0 obj\n<< /Type /Pages /Kids [] >>\nendobj\n${objects}%%EOF\n`;
};

describe('the limits', () => {
  it('are written down here and nowhere else', () => {
    expect(MAX_UPLOAD_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
    expect(MAX_PDF_PAGE_COUNT).toBe(20);
    expect(ACCEPTED_UPLOAD_EXTENSIONS).toStrictEqual(['.png', '.jpg', '.pdf', '.dwg']);
  });
});

describe('readExtension', () => {
  it('lowercases the extension and keeps the dot', () => {
    expect(readExtension('Mặt bằng TẦNG 2.PDF')).toBe('.pdf');
    expect(readExtension('scan.tar.DWG')).toBe('.dwg');
  });

  it('answers with an empty string when there is no dot', () => {
    expect(readExtension('ban-ve-khong-duoi')).toBe('');
  });
});

describe('validateUploadFile', () => {
  it('refuses a file over the size limit, with both numbers', async () => {
    const check = await validateUploadFile(
      candidate('lon.png', 'x', MAX_UPLOAD_FILE_SIZE_BYTES + 1),
    );

    expect(check).toStrictEqual({
      ok: false,
      reason: {
        kind: 'tooLarge',
        maxSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
        sizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES + 1,
      },
    });
  });

  it('accepts a file exactly on the size limit', async () => {
    const check = await validateUploadFile(candidate('vua.png', 'x', MAX_UPLOAD_FILE_SIZE_BYTES));

    expect(check.ok).toBe(true);
  });

  it('refuses an unsupported format and says what is accepted', async () => {
    const check = await validateUploadFile(candidate('ghi-chu.txt', 'x'));

    expect(check).toStrictEqual({
      ok: false,
      reason: {
        acceptedExtensions: ACCEPTED_UPLOAD_EXTENSIONS,
        extension: '.txt',
        kind: 'unsupportedFormat',
      },
    });
  });

  it('refuses a file with no extension at all', async () => {
    const check = await validateUploadFile(candidate('ban-ve', 'x'));

    expect(check.ok).toBe(false);
    expect(check.ok ? null : check.reason).toStrictEqual({
      acceptedExtensions: ACCEPTED_UPLOAD_EXTENSIONS,
      extension: '',
      kind: 'unsupportedFormat',
    });
  });

  it('reports the CAD branch for .dwg without the screen sniffing extensions', async () => {
    const check = await validateUploadFile(candidate('mat-bang.dwg', 'AutoCAD binary'));

    expect(check).toStrictEqual({
      branch: 'cad',
      extension: '.dwg',
      ok: true,
      sizeBytes: 14,
    });
  });

  it.each([
    ['anh.png', 'raster'],
    ['anh.jpg', 'raster'],
  ])('reports the raster branch for %s', async (name, branch) => {
    const check = await validateUploadFile(candidate(name, 'PNG bytes'));

    expect(check.ok && check.branch).toBe(branch);
  });

  it('accepts a PDF inside the page limit and reports the page count', async () => {
    const check = await validateUploadFile(candidate('ban-ve.pdf', pdfWithCount(3)));

    expect(check.ok).toBe(true);
    expect(check.ok ? check.branch : null).toBe('pdf');
    expect(check.ok ? check.pageCount : null).toBe(3);
  });

  it('accepts a PDF exactly on the page limit', async () => {
    const check = await validateUploadFile(
      candidate('ban-ve.pdf', pdfWithCount(MAX_PDF_PAGE_COUNT)),
    );

    expect(check.ok ? check.pageCount : null).toBe(MAX_PDF_PAGE_COUNT);
  });

  it('refuses a PDF over the page limit, with both numbers', async () => {
    const check = await validateUploadFile(
      candidate('day.pdf', pdfWithCount(MAX_PDF_PAGE_COUNT + 1)),
    );

    expect(check).toStrictEqual({
      ok: false,
      reason: {
        kind: 'tooManyPages',
        maxPageCount: MAX_PDF_PAGE_COUNT,
        pageCount: MAX_PDF_PAGE_COUNT + 1,
      },
    });
  });

  it('refuses bytes that are not a PDF at all', async () => {
    const check = await validateUploadFile(candidate('gia-mao.pdf', 'không phải PDF'));

    expect(check).toStrictEqual({
      ok: false,
      reason: { extension: '.pdf', kind: 'unreadable' },
    });
  });

  it('refuses an empty PDF', async () => {
    const check = await validateUploadFile(candidate('rong.pdf', ''));

    expect(check.ok ? null : check.reason.kind).toBe('unreadable');
  });

  it('accepts a PDF whose page tree it cannot see, and says nothing about pages', async () => {
    const check = await validateUploadFile(
      candidate('nen.pdf', `%PDF-1.7\n${'x'.repeat(500)}\n%%EOF\n`),
    );

    expect(check).toStrictEqual({ branch: 'pdf', extension: '.pdf', ok: true, sizeBytes: 516 });
  });
});

describe('readPdfPageCount', () => {
  it('reads the page tree total', async () => {
    await expect(readPdfPageCount(candidate('a.pdf', pdfWithCount(7)))).resolves.toBe(7);
  });

  it('takes the largest total when the tree has several nodes', async () => {
    const nested = `%PDF-1.4\n<< /Type /Pages /Count 4 >>\n<< /Type /Pages /Count 9 >>\n%%EOF\n`;

    await expect(readPdfPageCount(candidate('a.pdf', nested))).resolves.toBe(9);
  });

  it('falls back to counting leaf page objects', async () => {
    await expect(readPdfPageCount(candidate('a.pdf', pdfWithPageObjects(5)))).resolves.toBe(5);
  });

  it('does not mistake the /Pages parent for a page', async () => {
    await expect(readPdfPageCount(candidate('a.pdf', pdfWithPageObjects(0)))).resolves.toBe(0);
  });

  it('answers null when the bytes are not a PDF', async () => {
    await expect(readPdfPageCount(candidate('a.pdf', 'MZ'))).resolves.toBeNull();
  });

  it('answers null when the header sits past the first kilobyte', async () => {
    await expect(
      readPdfPageCount(candidate('a.pdf', `${'x'.repeat(2000)}%PDF-1.4\n`)),
    ).resolves.toBeNull();
  });

  it('finds a token lying across a scan window boundary, and counts it once', async () => {
    const token = '/Type /Page ';
    const header = '%PDF-1.4\n';
    // One token wholly inside the first window, one straddling the boundary,
    // one wholly inside the second — the middle one is what the carried-over
    // tail exists for, and the first two together prove nothing is counted twice.
    const straddleAt = SCAN_WINDOW_BYTES - 6;
    const parts = [
      header,
      'x'.repeat(1000 - header.length),
      token,
      'x'.repeat(straddleAt - 1000 - token.length),
      token,
      'x'.repeat(1000),
      token,
      'x'.repeat(1000),
    ];
    const text = parts.join('');

    expect(text.indexOf(token, 1000 + token.length)).toBe(straddleAt);
    await expect(readPdfPageCount(candidate('a.pdf', text))).resolves.toBe(3);
  });
});

describe('guessFloorFromFileName', () => {
  it.each([
    ['mat-bang-tang-2.pdf', 2, 'high'],
    ['tang2.pdf', 2, 'high'],
    ['Mặt bằng TẦNG 12.pdf', 12, 'high'],
    ['tang_3_ban_ve.dwg', 3, 'high'],
    ['floor 2.pdf', 2, 'high'],
    ['LEVEL 4.dwg', 4, 'high'],
    ['lau 2.pdf', 2, 'medium'],
    ['lầu 5.png', 5, 'medium'],
    ['FL3.pdf', 3, 'medium'],
    ['T2.pdf', 2, 'medium'],
    ['L2.dwg', 2, 'medium'],
    ['tret.pdf', 0, 'high'],
    ['tầng trệt.pdf', 0, 'high'],
    ['ground floor.pdf', 0, 'high'],
    ['GROUND.dwg', 0, 'high'],
    ['ham.pdf', -1, 'high'],
    ['hầm 2.pdf', -2, 'high'],
    ['tang ham 1.pdf', -1, 'high'],
    ['basement.dwg', -1, 'high'],
    ['BASEMENT 3.pdf', -3, 'high'],
    ['B1.pdf', -1, 'medium'],
  ])('reads %s as level %i', (name, level, confidence) => {
    const guess = guessFloorFromFileName(name);

    expect(guess.ok).toBe(true);
    expect(guess.ok ? guess.level : null).toBe(level);
    expect(guess.ok ? guess.confidence : null).toBe(confidence);
    expect(guess.ok ? guess.matchedText.length : 0).toBeGreaterThan(0);
  });

  it.each(['trang-3.pdf', 'sheet3.pdf', 'p3.pdf', 'A-101 page 7.pdf', 'PG2.dwg'])(
    'does not mistake the sheet number in %s for a floor',
    (name) => {
      expect(guessFloorFromFileName(name)).toStrictEqual({ ok: false });
    },
  );

  it('reads the floor and ignores the sheet number in the same name', () => {
    const guess = guessFloorFromFileName('mat-bang-tang-2-trang-3.pdf');

    expect(guess.ok ? guess.level : null).toBe(2);
  });

  it('prefers an explicit floor over an ambiguous block letter', () => {
    const guess = guessFloorFromFileName('ban-ve-B2-tang-3.pdf');

    expect(guess.ok ? guess.level : null).toBe(3);
    expect(guess.ok ? guess.confidence : null).toBe('high');
  });

  it('does not read the extension as a floor', () => {
    expect(guessFloorFromFileName('mat-bang.p2')).toStrictEqual({ ok: false });
  });

  it.each(['A-101.pdf', 'mat bang tong the.dwg', 'scan.png', '', 'phối cảnh.png'])(
    'misses on %s, which is a normal answer',
    (name) => {
      expect(guessFloorFromFileName(name)).toStrictEqual({ ok: false });
    },
  );

  it('never throws, whatever it is handed', () => {
    const notAString = 42 as unknown as string;

    expect(() => guessFloorFromFileName(notAString)).not.toThrow();
    expect(guessFloorFromFileName(notAString)).toStrictEqual({ ok: false });
  });
});
