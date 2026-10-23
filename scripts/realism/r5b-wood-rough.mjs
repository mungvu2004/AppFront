/**
 * M2 (bước 2) — gỗ và sàn gỗ bớt bóng như vecni. Vá `roughness` trong `MATERIAL_CATALOG`
 * (`core/src/material-library.ts`) lúc dựng, không sửa `vendor/pascal`.
 *
 * three nhân `roughness` với kênh G của roughnessMap. Upstream đặt 0.45–0.5 nên gỗ có map chỉ còn
 * ~0.17–0.35 (finewood27 0.5 x 0.34, parquet76 0.5 x 0.70) → phản chiếu HDRI như sơn bóng.
 * - Có map: 1 = dùng đúng độ nhám tác giả ảnh vẽ (PBR chuẩn). Schema Pascal chặn > 1 nên không bù thêm.
 * - Không map (wood_fine*, floor_plank_1): 0.7 = gỗ sơn mờ/dầu.
 * Gốm vân gỗ (`flooring-woodenceramic*`) giữ nguyên: là gạch men.
 */
import { readFileSync } from 'node:fs';

import { LIBRARY_FILE } from '../pascal-material-webp.mjs';

/** `[id, roughness gốc, mới]`; gốc sai → lượt dựng đỏ (upstream đã đổi, xem lại). */
export const WOOD_ROUGHNESS = Object.freeze([
  ['wood-finewood27', 0.5, 1],
  ['wood-floorplank1', 0.45, 0.7],
  ['wood-hungarianparquet10', 0.5, 1],
  ['wood-hungarianparquet2', 0.5, 1],
  ['wood-squareparquet21', 0.5, 1],
  ['wood-squareparquet23', 0.5, 1],
  ['wood-woodfine1', 0.45, 0.7],
  ['wood-woodfine11', 0.45, 0.7],
  ['wood-woodfine13', 0.45, 0.7],
  ['wood-woodfine2', 0.45, 0.7],
  ['wood-woodfine22', 0.45, 0.7],
  ['wood-woodfine24', 0.45, 0.7],
  ['wood-woodparquet14', 0.5, 1],
  ['wood-woodenparquet11', 0.5, 1],
  ['wood-woodparquet121', 0.5, 1],
  ['wood-woodparquet56', 0.5, 1],
  ['wood-woodparquet65', 0.5, 1],
  ['wood-woodparquet99', 0.5, 1],
  ['wood-woodplank19', 0.5, 1],
  ['wood-woodplank48', 0.5, 1],
  ['flooring-woodparquet76', 0.5, 1],
]);

/**
 * Neo = đoạn từ `preset: {` của mục tới dòng `roughness: <gốc>,` (duy nhất vì chứa đường map riêng).
 * Bỏ qua label/description vì `pascal-vi` dịch chúng trước plugin này. Không chạm neo cuối mảng của r5.
 */
export function woodRules(source) {
  const lib = source.replaceAll('\r\n', '\n');
  return WOOD_ROUGHNESS.map(([id, from, to]) => {
    const start = lib.indexOf(`    id: '${id}',\n`);
    const line = `\n        roughness: ${from},`;
    const end = lib.indexOf(line, start);
    const next = lib.indexOf("\n    id: '", start + 1);
    if (start < 0 || end < 0 || (next >= 0 && end > next)) {
      throw new Error(`r5b-wood-rough: không thấy "${id}" với roughness ${from} trong material-library.ts — upstream đã đổi`);
    }
    const anchor = lib.slice(lib.indexOf('\n    preset: {\n', start), end + line.length);
    return [anchor, anchor.slice(0, -line.length) + `\n        roughness: ${to},`, 1];
  });
}

export const RULES = { 'core/src/material-library.ts': woodRules(readFileSync(LIBRARY_FILE, 'utf8')) };
