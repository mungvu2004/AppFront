/**
 * Hồ sơ PDF thành tệp .pdf thật, không thư viện (UX-05).
 *
 * Mỗi trang của {@link PdfDocument} được vẽ lên một canvas A4 (~150 dpi), mã hoá
 * JPEG, rồi gói thành một PDF 1.4 tối thiểu: mỗi trang một `/Image` XObject
 * `/DCTDecode` phủ kín trang. Chữ là ảnh nên không cần nhúng phông.
 *
 * ponytail: chữ trong PDF là ảnh (không chọn/tìm được chữ); cần chữ thật thì
 * nhúng phông Noto Sans và viết luồng văn bản.
 */
import { fitText, lineHeightOf } from './fitText';
import type { PdfDocument, PdfPage, PdfTableColumn, PdfTableRow } from './pdfSchema';
import { PDF_INK } from './printStyles';

/** Một trang đã mã hoá JPEG. */
export interface JpegPage {
  readonly jpeg: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Khổ A4 theo điểm PDF (1/72 inch). */
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;

/** A4 ở ~150 dpi. */
export const PAGE_WIDTH_PX = 1240;
export const PAGE_HEIGHT_PX = 1754;

const MARGIN_PX = 96;
const TITLE_PX = 36;
const BODY_PX = 20;
const SMALL_PX = 16;
const FOOTER_RESERVE_PX = 80;
const JPEG_QUALITY = 0.85;
const FONT_STACK = '"Noto Sans", "Be Vietnam Pro", "DejaVu Sans", sans-serif';
const INK = PDF_INK.text;
const MUTED = PDF_INK.muted;
const RULE = PDF_INK.rule;

/** Gói các trang JPEG thành byte của một tệp PDF 1.4 hợp lệ. */
export function writeJpegPdf(pages: readonly JpegPage[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (part: string | Uint8Array): void => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, ...body: (string | Uint8Array)[]): void => {
    offsets[id] = length;
    push(`${String(id)} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };

  // Dòng chú thích thứ hai có byte > 127 để công cụ đọc biết tệp là nhị phân.
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageIds = pages.map((_, index) => 3 + index * 3);

  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(' ')}] /Count ${String(pages.length)} >>`,
  );

  pages.forEach((page, index) => {
    const pageId = pageIds[index]!;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const content = `q ${String(A4_WIDTH_PT)} 0 0 ${String(A4_HEIGHT_PT)} 0 0 cm /Im0 Do Q`;

    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(A4_WIDTH_PT)} ${String(A4_HEIGHT_PT)}] ` +
        `/Resources << /XObject << /Im0 ${String(imageId)} 0 R >> >> /Contents ${String(contentId)} 0 R >>`,
    );
    object(
      imageId,
      `<< /Type /XObject /Subtype /Image /Width ${String(page.widthPx)} /Height ${String(page.heightPx)} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${String(page.jpeg.length)} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    );
    object(contentId, `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`);
  });

  const size = 3 + pages.length * 3;
  const xrefOffset = length;
  let xref = `xref\n0 ${String(size)}\n0000000000 65535 f \n`;

  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${String(size)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;

  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Vẽ một trang lên canvas.                                                    */
/* -------------------------------------------------------------------------- */

type Ctx = CanvasRenderingContext2D;

const font = (px: number, bold = false): string => `${bold ? '600 ' : ''}${String(px)}px ${FONT_STACK}`;

interface TextStyle {
  readonly bold?: boolean;
  readonly color?: string;
  readonly align?: CanvasTextAlign;
}

function text(ctx: Ctx, value: string, x: number, y: number, px: number, maxWidth: number, opts: TextStyle = {}): void {
  ctx.font = font(px, opts.bold);
  ctx.fillStyle = opts.color ?? INK;
  ctx.textAlign = opts.align ?? 'left';
  ctx.fillText(fitText(value, px, maxWidth), x, y, maxWidth);
}

/** Bẻ một câu dài thành nhiều dòng vừa khổ. */
function wrap(ctx: Ctx, value: string, px: number, maxWidth: number): string[] {
  ctx.font = font(px);
  const lines: string[] = [];
  let line = '';

  for (const word of value.split(/\s+/)) {
    const next = line === '' ? word : `${line} ${word}`;

    if (line !== '' && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line !== '') {
    lines.push(line);
  }

  return lines;
}

function drawTable(ctx: Ctx, columns: readonly PdfTableColumn[], rows: readonly PdfTableRow[], top: number): number {
  const width = PAGE_WIDTH_PX - MARGIN_PX * 2;
  const columnWidth = width / Math.max(columns.length, 1);
  const rowHeight = lineHeightOf(BODY_PX) + 10;
  const bottom = PAGE_HEIGHT_PX - FOOTER_RESERVE_PX;
  let y = top;

  const drawRow = (cells: readonly string[], bold: boolean): void => {
    columns.forEach((column, index) => {
      const right = column.alignment === 'right';
      const x = MARGIN_PX + columnWidth * index + (right ? columnWidth - 8 : 0);
      text(ctx, cells[index] ?? '', x, y + BODY_PX, BODY_PX, columnWidth - 12, {
        bold,
        align: right ? 'right' : 'left',
      });
    });
    y += rowHeight;
    ctx.fillStyle = RULE;
    ctx.fillRect(MARGIN_PX, y - 6, width, 1);
  };

  drawRow(
    columns.map((column) => column.label),
    true,
  );
  for (const [index, row] of rows.entries()) {
    if (y + rowHeight > bottom) {
      // ponytail: bảng dài hơn một trang bị cắt kèm câu báo; tách trang khi hồ sơ thật cần.
      const rest = `… còn ${String(rows.length - index)} dòng không vừa trang`;
      text(ctx, rest, MARGIN_PX, y + BODY_PX, SMALL_PX, width, { color: MUTED });
      y += rowHeight;
      break;
    }
    drawRow(row.cells, false);
  }

  return y;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error('Không đọc được ảnh 3D đính kèm.'));
    };
    image.src = src;
  });
}

async function drawPage(ctx: Ctx, page: PdfPage): Promise<void> {
  const width = PAGE_WIDTH_PX - MARGIN_PX * 2;

  ctx.fillStyle = PDF_INK.paper;
  ctx.fillRect(0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
  ctx.textBaseline = 'alphabetic';

  let y = MARGIN_PX + TITLE_PX;
  text(ctx, page.title, MARGIN_PX, y, TITLE_PX, width, { bold: true });
  y += lineHeightOf(TITLE_PX) + 16;

  switch (page.kind) {
    case 'cover': {
      text(ctx, page.projectNameText, MARGIN_PX, y, 28, width, { bold: true });
      y += lineHeightOf(28) + 24;
      for (const field of page.fields) {
        text(ctx, field.label, MARGIN_PX, y, BODY_PX, width * 0.35, { color: MUTED });
        text(ctx, field.text, MARGIN_PX + width * 0.35, y, BODY_PX, width * 0.65);
        y += lineHeightOf(BODY_PX) + 8;
      }
      if (page.preparerNoteText !== undefined) {
        y += 16;
        for (const line of wrap(ctx, page.preparerNoteText, BODY_PX, width)) {
          text(ctx, line, MARGIN_PX, y, BODY_PX, width, { color: MUTED });
          y += lineHeightOf(BODY_PX);
        }
      }
      break;
    }
    case 'levelSummary':
      drawTable(ctx, page.columns, page.rows, y);
      break;
    case 'roomAreas': {
      y = drawTable(ctx, page.columns, page.rows, y) + 16;
      text(ctx, `${page.totalArea.label}: ${page.totalArea.text}`, MARGIN_PX, y, BODY_PX, width, { bold: true });
      break;
    }
    case 'violations':
      if (page.rows.length === 0 && page.emptyText !== undefined) {
        text(ctx, page.emptyText, MARGIN_PX, y, BODY_PX, width);
      } else {
        drawTable(ctx, page.columns, page.rows, y);
      }
      break;
    case 'attachments': {
      const slot = (PAGE_HEIGHT_PX - FOOTER_RESERVE_PX - y) / Math.max(page.images.length, 1);
      for (const attachment of page.images) {
        const image = await loadImage(attachment.pngDataUrl);
        const boxHeight = slot - lineHeightOf(BODY_PX) * 2 - 16;
        const scale = Math.min(width / image.width, boxHeight / image.height);
        ctx.drawImage(image, MARGIN_PX, y, image.width * scale, image.height * scale);
        text(ctx, attachment.captionText, MARGIN_PX, y + boxHeight + BODY_PX + 8, BODY_PX, width, { color: MUTED });
        y += slot;
      }
      break;
    }
  }

  const footerY = PAGE_HEIGHT_PX - MARGIN_PX / 2;
  text(ctx, page.footer.pageText, MARGIN_PX, footerY, SMALL_PX, width / 2, { color: MUTED });
  text(ctx, page.footer.versionText, PAGE_WIDTH_PX - MARGIN_PX, footerY, SMALL_PX, width / 2, {
    color: MUTED,
    align: 'right',
  });
}

function canvasJpeg(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('Không dựng được trang PDF.'));
          return;
        }
        void blob.arrayBuffer().then((buffer) => {
          resolve(new Uint8Array(buffer));
        }, reject);
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** Vẽ cả hồ sơ thành một `Blob` `application/pdf`. Chỉ chạy trong trình duyệt. */
export async function renderPdfBlob(document: PdfDocument): Promise<Blob> {
  const canvas = window.document.createElement('canvas');
  canvas.width = PAGE_WIDTH_PX;
  canvas.height = PAGE_HEIGHT_PX;
  const ctx = canvas.getContext('2d');

  if (ctx === null) {
    throw new Error('Trình duyệt này không dựng được tệp PDF.');
  }

  // Chờ phông tiếng Việt nạp xong, nếu không chữ có dấu vẽ bằng phông dự phòng.
  await window.document.fonts.ready;

  const pages: JpegPage[] = [];

  for (const page of document.pages) {
    await drawPage(ctx, page);
    pages.push({ jpeg: await canvasJpeg(canvas), widthPx: PAGE_WIDTH_PX, heightPx: PAGE_HEIGHT_PX });
  }

  const bytes = writeJpegPdf(pages);

  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/** Lối phụ "In": nạp tệp PDF vào khung ẩn rồi mở hộp thoại in của trình duyệt. */
export function printPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const frame = window.document.createElement('iframe');

  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  frame.src = url;
  frame.onload = () => {
    frame.contentWindow?.print();
  };
  // ponytail: khung và URL sống tới khi rời trang; hộp thoại in không báo lúc đóng.
  window.document.body.append(frame);
}
