/**
 * UX41 U20: kéo chuột trái trên nền 3D thì xoay cảnh, như mọi trình xem 3D, thay vì quét chọn hàng loạt
 * (người dùng kéo để xoay thì ra "Đã chọn 31" kèm nút Xoá). Quét chọn vẫn còn: giữ Shift/Ctrl/Cmd khi kéo,
 * hoặc dùng công cụ chọn vùng (`floorplanSelectionTool === 'marquee'`, không đụng tới).
 * Luật `scripts/realism/u20-left-orbit.mjs` nối hai hàm này vào `ScreenRectangleSelectTool` của vendor,
 * nên chỉ lần kéo mà tay cầm / kéo-dời vật KHÔNG giành mới thành xoay.
 */

type Modifiers = { readonly shiftKey: boolean; readonly ctrlKey: boolean; readonly metaKey: boolean };

/** Kéo có phím phụ = quét chọn (Shift/Ctrl/Cmd cũng là "chọn thêm" của vendor). */
export function wantsBoxSelect(event: Modifiers): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey;
}

/**
 * Ngưỡng bắt đầu xoay: gấp đôi ngưỡng 4 px của kéo-dời vật (`selection-manager` DIRECT_DRAG_THRESHOLD_PX),
 * để kéo trên vật đang chọn vẫn dời vật, không xoay camera cùng lúc.
 */
export const ORBIT_START_PX = 8;

/** Cùng tốc độ kéo xoay của camera-controls: 2π mỗi chiều cao khung. Trả `[phương vị, góc cực]` (radian). */
export function orbitAngles(dx: number, dy: number, height: number): [number, number] {
  const perPx = (2 * Math.PI) / Math.max(1, height);
  return [-dx * perPx, -dy * perPx];
}

type Rotatable = { rotate: (azimuth: number, polar: number, enableTransition?: boolean) => unknown };

/** Xoay `controls` mặc định của R3F (CameraControls `makeDefault`); thiếu thì bỏ qua. */
export function orbitBy(controls: unknown, dx: number, dy: number, height: number): void {
  const rotate = (controls as Partial<Rotatable> | null | undefined)?.rotate;
  if (typeof rotate !== 'function') return;
  const [azimuth, polar] = orbitAngles(dx, dy, height);
  rotate.call(controls, azimuth, polar, true);
}
