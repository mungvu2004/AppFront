/**
 * Hình học dùng chung của khung xem bản vẽ: tỉ lệ 0..1 vào, phần trăm CSS ra.
 *
 * Ba hàm này ở một file riêng vì cả `InputQualityGateImagePanel.tsx` lẫn
 * `InputQualityGateImageOverlays.tsx` đều gọi tới, và một file vừa xuất
 * component vừa xuất hàm thì Fast Refresh mất tác dụng cho cả file
 * (`react-refresh/only-export-components`). Không có JSX ở đây, cũng không có
 * một quyết định giao diện nào — chỉ phép nhân và phép kẹp biên.
 *
 * Không có định dạng số ở đây (A15): `percentOf` trả một chuỗi cho CSS đọc, chứ
 * không phải một con số cho người đọc. Con số cho người đọc đã xong ở hook,
 * theo đúng `types.ts`.
 */

/** Nhân tỉ lệ thành phần trăm CSS — không định dạng, không làm tròn (A15). */
export const PERCENT_SCALE = 100;

/** Kẹp một tỉ lệ về trong khung. Ngoài khung thì không còn là một điểm trên ảnh. */
export function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Tỉ lệ 0..1 thành chuỗi phần trăm cho `left`/`top`/`width`/`height`. */
export function percentOf(ratio: number): string {
  return `${ratio * PERCENT_SCALE}%`;
}
