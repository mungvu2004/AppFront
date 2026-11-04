/**
 * Cảm giác camera của editor 3D (luật `scripts/realism/u45-camera-feel.mjs`, alias `@pascal-camera-feel`).
 * Chỉ có quyết định thuần ở đây để test được; mã vendor gọi vào lúc dựng.
 */

/**
 * Độ mượt riêng cho nấc lăn chuột. camera-controls dùng `draggingSmoothTime` (không phải `smoothTime`) cho
 * bánh xe, nên nấc lăn đang chạy 0,03 s: 4 hình / 154 ms ở 26 hình/s, khớp số đo video. 0,1 s cho 9 hình / 346 ms
 * và bước lớn nhất mỗi hình còn 28 % nấc (trước 67 %). Không lấy 0,16 (13 hình) dù mượt hơn: mặc định cũ 0,125
 * (~0,4 s) đã bị chê là trễ.
 */
export const WHEEL_ZOOM_SMOOTH_S = 0.1;
/** Kéo xoay/kéo khung giữ bám con trỏ; bằng `draggingSmoothTime` khai ở `custom-camera-controls.tsx`. */
export const DRAG_SMOOTH_S = 0.03;

export type WheelKind = 'zoom' | 'pan' | 'pinch';

interface WheelInput {
  readonly ctrlKey: boolean;
  readonly deltaMode: number;
  readonly deltaX: number;
  readonly deltaY: number;
}

/** Luồng vuốt có quán tính: khoảng nghỉ giữa hai sự kiện ngắn hơn mức này vẫn là cùng một lần vuốt. */
const PAN_STICKY_MS = 200;
/** Một nấc bánh xe trên Windows/Chrome là 100 px trở lên (máy này 120); vuốt thường cho vài chục px. */
const NOTCH_MIN_DELTA = 50;

/**
 * Trình duyệt không cho biết thiết bị, nên đoán từ hình dạng sự kiện.
 * ponytail: heuristic. Chuột cuộn mịn (MX Master, chuột trên macOS) cho delta nhỏ nên bị coi là vuốt = kéo khung;
 * cú vuốt đầu tiên rất mạnh, thẳng đứng (≥ 50 px) bị coi là một nấc zoom. Khi có người dùng các loại đó, thêm một
 * tuỳ chọn "Bánh xe: thu phóng / kéo khung" thay vì đoán.
 */
export function classifyWheel(event: WheelInput, msSinceLastPan: number): WheelKind {
  if (event.ctrlKey) return 'pinch';
  if (event.deltaMode !== 0) return 'zoom';
  if (msSinceLastPan < PAN_STICKY_MS || event.deltaX !== 0) return 'pan';
  return Math.abs(event.deltaY) >= NOTCH_MIN_DELTA ? 'zoom' : 'pan';
}

/**
 * Hệ số nhân khoảng cách cho một sự kiện chụm: Chrome báo `deltaY = -100·ln(tỉ lệ)`, nên chụm bám đúng tay.
 * Chặn ±25 để Ctrl + bánh xe thật (delta 120) chỉ nhảy cỡ một nấc thường (×1,28), không ×3,3.
 */
export function pinchScale(deltaY: number): number {
  return Math.exp(Math.max(-25, Math.min(25, deltaY)) / 100);
}

/** Tường vừa hết sáng được về lưới gộp khi camera đứng yên và cảnh đã im đủ lâu (rê qua nhiều tường không gộp đi gộp lại). */
export function wallsReadyToRejoin(
  released: Iterable<string>,
  lit: ReadonlySet<string>,
  cameraMoving: boolean,
  quietMs: number,
  settleMs: number,
): string[] {
  if (cameraMoving || quietMs < settleMs) return [];
  return [...released].filter((id) => !lit.has(id));
}
