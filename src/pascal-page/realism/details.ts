/**
 * GĐ6 (thẻ R6): chi tiết hình khối bật sẵn cho node MỚI do công cụ vẽ tạo ra.
 *
 * Cách phân biệt node mới/cũ: theo ĐƯỜNG TẠO, không theo dữ liệu. Các hàm dưới
 * chỉ được gọi ở chỗ công cụ vẽ dựng node (luật `scripts/realism/r6-details.mjs`
 * chèn vào roof/tool.tsx, wall-drafting.ts, rectangle-command.ts), và được trải
 * TRƯỚC `...defaults` của công cụ nên preset người dùng chọn vẫn thắng.
 * Schema `core` không đổi, nên dự án cũ nạp lại (node thiếu trường) giữ nguyên.
 *
 * Không nhập store: `main.tsx` (thẻ R1) gọi `setDetailsEnabled(flags.details)`.
 */

let enabled = true

export function setDetailsEnabled(value: boolean): void {
  enabled = value
}

export function isDetailsEnabled(): boolean {
  return enabled
}

/** Mặc định cho roof-segment mới: ván diềm (fascia) + máng xối tự động. */
export function realismRoofSegmentDefaults(): Record<string, unknown> {
  if (!enabled) return {}
  return { fascia: true, metadata: { autoGutter: true } }
}

/** Phào chân ngoài tường (thay bệ chân nhà) cho tường mới vẽ. */
export const EXTERIOR_SKIRTING = {
  enabled: true,
  sides: 'exterior',
  height: 0.25,
  proud: 0.02,
  profile: 'flat',
} as const

/** Mặc định cho tường mới. */
export function realismWallDefaults(): Record<string, unknown> {
  if (!enabled) return {}
  return { skirting: { ...EXTERIOR_SKIRTING } }
}
