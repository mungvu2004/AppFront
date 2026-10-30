import type { DataSource } from '../../domain/spatial/types';
import { STANDARD_THICKNESSES_MM } from '../../domain/walls/cleanup';
import type { WallThickness } from '../../types/spatial';

export interface StandardizeResult {
  original_mm: number;
  standardized: WallThickness;
}

/**
 * Trên ngưỡng này là cột BTCT. Ngưỡng cũ 350 nằm dưới bậc 400 của danh mục, nên dời lên
 * 400 + 50 (nửa bước 300→400) để bậc 400 vẫn bắt được.
 */
export const CONCRETE_COLUMN_THRESHOLD_MM = 450;

/**
 * Số đo của máy dư khoảng một nét vẽ (U19: mặt nạ tường chạy từ mép ngoài nét này sang mép ngoài
 * nét kia, nên tường 240 đo ra 261). Tường máy đo (`source: 'ai'`) lấy bậc LỚN NHẤT không vượt
 * số đo + 15 mm thay vì bậc gần nhất: 261 → 220, 330 → 300, 240 → 220.
 * ponytail: bù cố định 15 mm; bỏ khi máy chủ đo độ dày giữa tâm hai nét (handoff U19 vòng 1).
 */
export const AI_THICKNESS_OVERSHOOT_MM = 15;

/**
 * Bắt độ dày đo về bậc gần nhất của `STANDARD_THICKNESSES_MM`; hoà lấy số nhỏ hơn — đúng
 * như máy chủ (AppBack `apps/worker/pipeline_build/geometry.py:199-200`). Trên
 * {@link CONCRETE_COLUMN_THRESHOLD_MM} là `CONCRETE_COLUMN`. Tường máy đo (`source: 'ai'`)
 * dùng luật {@link AI_THICKNESS_OVERSHOOT_MM}.
 */
export function standardizeThickness(rawThicknessMm: number, source: DataSource = 'human'): StandardizeResult {
  if (rawThicknessMm > CONCRETE_COLUMN_THRESHOLD_MM) {
    return { original_mm: rawThicknessMm, standardized: 'CONCRETE_COLUMN' };
  }

  const standardized: WallThickness =
    source === 'ai'
      ? STANDARD_THICKNESSES_MM.reduce((best, value) =>
          value <= rawThicknessMm + AI_THICKNESS_OVERSHOOT_MM ? value : best,
        )
      : STANDARD_THICKNESSES_MM.reduce((best, value) =>
          Math.abs(value - rawThicknessMm) < Math.abs(best - rawThicknessMm) ? value : best,
        );

  return { original_mm: rawThicknessMm, standardized };
}

/**
 * Khoảng số đo nguyên (mm) mà {@link standardizeThickness} đưa về bậc `tierMm` — sinh từ chính
 * thang sáu bậc (biên = trung điểm hai bậc kề, hoà về bậc nhỏ) và ngưỡng cột:
 * 150 → `{ fromMm: 126, toMm: 175 }`. Bậc nhỏ nhất không có biên dưới (`fromMm: null`).
 * Tường máy đo: biên = bậc − 15 mm (220 → `{ fromMm: 205, toMm: 284 }`).
 */
export function standardTierRangeOf(
  tierMm: number,
  source: DataSource = 'human',
): { readonly fromMm: number | null; readonly toMm: number } {
  const index = (STANDARD_THICKNESSES_MM as readonly number[]).indexOf(tierMm);
  const previous = STANDARD_THICKNESSES_MM[index - 1];
  const next = STANDARD_THICKNESSES_MM[index + 1];

  if (source === 'ai') {
    return {
      fromMm: previous === undefined ? null : tierMm - AI_THICKNESS_OVERSHOOT_MM,
      toMm: next === undefined ? CONCRETE_COLUMN_THRESHOLD_MM : next - AI_THICKNESS_OVERSHOOT_MM - 1,
    };
  }

  return {
    fromMm: previous === undefined ? null : Math.floor((previous + tierMm) / 2) + 1,
    toMm: next === undefined ? CONCRETE_COLUMN_THRESHOLD_MM : Math.floor((tierMm + next) / 2),
  };
}
