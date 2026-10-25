/**
 * Dung sai độ dày tường dùng chung (R-3, R-7 vòng R3).
 *
 * Trước đây màn Duyệt lớp tường so độ dày bằng `===` với 110/220/330 còn màn
 * Chuẩn hoá độ dày dùng dung sai 30 mm, nên cùng một tường 116 mm vừa "cần chú
 * ý" vừa "trong dung sai". Hai màn đọc chung hằng và hàm ở đây.
 */
export const WALL_THICKNESS_TOLERANCE_MM = 30;

/** Độ dày đo được có cách một chuẩn bất kỳ không quá `toleranceMm` (tính cả biên). */
export function isWithinThicknessTolerance(
  measuredMm: number,
  standardsMm: readonly number[],
  toleranceMm: number = WALL_THICKNESS_TOLERANCE_MM,
): boolean {
  return standardsMm.some((standardMm) => Math.abs(standardMm - measuredMm) <= toleranceMm);
}
