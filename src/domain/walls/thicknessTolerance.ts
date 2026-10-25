/**
 * Dung sai và luật làm tròn độ dày tường dùng chung (R-3, R-7 vòng R3; S-15/S-21 vòng Z).
 *
 * Trước đây màn Duyệt lớp tường so độ dày bằng `===` với 110/220/330 còn màn
 * Chuẩn hoá độ dày dùng dung sai 30 mm, nên cùng một tường 116 mm vừa "cần chú
 * ý" vừa "trong dung sai". Hai màn đọc chung hằng và hàm ở đây.
 */
export const WALL_THICKNESS_TOLERANCE_MM = 30;

/** Ba độ dày chuẩn của tường gạch, mm. */
export const WALL_THICKNESS_STANDARDS_MM = [110, 220, 330] as const;

/**
 * Bốn biên của luật làm tròn (chủ dự án duyệt theo demo S-15), mỗi số là mức NHỎ NHẤT của
 * khoảng bên trên nó (so bằng `>=`):
 *
 * - dưới 80 mm: nghi AI nhận nhầm, xem tay, không tự đổi;
 * - 80–165 → 110; 166–275 → 220; 276–399 → 330;
 * - từ 400 mm: dày bất thường (có thể là cột BTCT), xem tay, không tự đổi.
 */
export const WALL_THICKNESS_ROUNDING_BOUNDS_MM = [80, 166, 276, 400] as const;

/** Dưới mức này: nghi AI nhận nhầm. */
export const WALL_THICKNESS_MIN_MM = WALL_THICKNESS_ROUNDING_BOUNDS_MM[0];

/** Từ mức này trở lên: dày bất thường, xem tay. */
export const WALL_THICKNESS_MANUAL_MM = WALL_THICKNESS_ROUNDING_BOUNDS_MM[3];

/** Kết quả làm tròn: một độ dày chuẩn, hoặc một trong hai lý do phải xem tay. */
export type WallThicknessRounding = (typeof WALL_THICKNESS_STANDARDS_MM)[number] | 'tooThin' | 'tooThick';

/** Làm tròn một số đo về độ dày chuẩn theo {@link WALL_THICKNESS_ROUNDING_BOUNDS_MM}. */
export function roundWallThickness(measuredMm: number): WallThicknessRounding {
  const [minMm, to220Mm, to330Mm, manualMm] = WALL_THICKNESS_ROUNDING_BOUNDS_MM;

  if (measuredMm < minMm) return 'tooThin';
  if (measuredMm < to220Mm) return 110;
  if (measuredMm < to330Mm) return 220;
  if (measuredMm < manualMm) return 330;
  return 'tooThick';
}

/** Độ dày đo được có cách một chuẩn bất kỳ không quá `toleranceMm` (tính cả biên). */
export function isWithinThicknessTolerance(
  measuredMm: number,
  standardsMm: readonly number[],
  toleranceMm: number = WALL_THICKNESS_TOLERANCE_MM,
): boolean {
  return standardsMm.some((standardMm) => Math.abs(standardMm - measuredMm) <= toleranceMm);
}
