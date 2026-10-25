/**
 * Cách viết số của màn Quản lý tầng (S-19 bản Z), MỘT chỗ cho bảng, lát cắt và câu tóm tắt:
 * cao độ là mét theo thói quen bản vẽ (`+3.000`, `±0.000`), chiều cao là mm tách nghìn (`3.600`).
 */

import { formatNumber } from '@/lib/format/number';

const ZERO_ELEVATION = '±0.000';
const MINUS_SIGN = '−';

/** Viết số mm có tách nghìn bằng dấu chấm thì ra đúng chuỗi mét 3 chữ số (3000 mm → "3.000"). */
export function elevationSignedText(valueMm: number): string {
  const rounded = Math.round(valueMm);

  if (rounded === 0) {
    return ZERO_ELEVATION;
  }

  const absolute = Math.abs(rounded);
  // ponytail: dưới 1 m tự đệm "0."; cao độ trên 999 m sẽ sai nhóm.
  const body = absolute < 1000 ? `0.${String(absolute).padStart(3, '0')}` : formatNumber(absolute, { fractionDigits: 0 });

  return `${rounded > 0 ? '+' : MINUS_SIGN}${body}`;
}

/** Chiều cao tầng bằng mm, tách nghìn: 3600 → "3.600". */
export const heightMmText = (valueMm: number): string => formatNumber(Math.round(valueMm), { fractionDigits: 0 });
