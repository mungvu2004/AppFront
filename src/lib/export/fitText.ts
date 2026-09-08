/**
 * Đo chữ bằng ước lượng — phần thuần của `screenshot.ts`, tách ra để nhập được
 * một mình.
 *
 * `fitText` là số học trên một chuỗi: không canvas, không `three`, không token
 * màu. Nhưng nó từng nằm giữa `src/lib/export/screenshot.ts`, và `screenshot.ts`
 * mở đầu bằng `import { WebGLRenderTarget } from 'three'`. Nên
 * `roomLabelReviewGateway.ts` — một cổng của màn soát nhãn phòng, hỏi đúng một
 * câu "chuỗi này có vừa cột không" — kéo theo cả `three` (137 KiB gzip) cùng
 * bảng chú giải và bộ chữ PDF vào bao đóng nhập tĩnh của màn ấy. Cổng kích
 * thước gói đo đúng thứ đó và đỏ.
 *
 * Chỗ sửa không phải cổng: một hàm thuần thì nhập được một mình, và ba hằng số
 * dưới đây đi cùng nó vì không ai khác đọc chúng. `screenshot.ts` tái xuất
 * `fitText` nên mọi nơi gọi cũ giữ nguyên đường nhập.
 */

/**
 * Leading as a multiple of the font size.
 *
 * 1,45 rather than the usual 1,2 because Vietnamese stacks two marks on one
 * letter — `ệ`, `ữ`, `ỗ` — and a line box cut to Latin ascenders clips the
 * upper one. The band is the one place in the product where a clipped diacritic
 * cannot be fixed by scrolling: it is already a file.
 */
export const VIETNAMESE_LINE_HEIGHT = 1.45;

/**
 * The width of an average glyph, as a fraction of the font size.
 *
 * Used only to decide where to cut a string that would otherwise run into the
 * next field. It is an estimate and is deliberately generous — measuring
 * properly would mean owning a canvas context before the layout exists, which
 * would make the layout untestable to save a few pixels of slack.
 */
export const AVERAGE_GLYPH_RATIO = 0.58;

/** The character a truncated string ends with. */
const ELLIPSIS = '…';

/** The height of one line of type at a given size. */
export function lineHeightOf(fontPx: number): number {
  return Math.round(fontPx * VIETNAMESE_LINE_HEIGHT);
}

/** A string cut to fit a width, with an ellipsis where it was cut. */
export function fitText(text: string, fontPx: number, maxWidthPx: number): string {
  const glyphs = Math.floor(maxWidthPx / (fontPx * AVERAGE_GLYPH_RATIO));

  if (glyphs <= 0) {
    return '';
  }
  if (text.length <= glyphs) {
    return text;
  }

  return `${text.slice(0, Math.max(glyphs - 1, 0)).trimEnd()}${ELLIPSIS}`;
}
