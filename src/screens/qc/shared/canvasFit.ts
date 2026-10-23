/**
 * "Vừa khung" dùng chung cho canvas 2D của màn QC (Duyệt tường, Đối tượng) — BUG-403.
 *
 * Toạ độ vẽ là pixel bản vẽ, mà tầng chưa hiệu chỉnh đọc một milimét thành một pixel: mặt bằng
 * 8 × 6 m là 8.220 × 6.220 px. Hai canvas từng vẽ nó ở hệ số 1 (Đối tượng không có khung nhìn
 * nào, Duyệt tường lấy tâm nhìn làm độ dời), nên khung 700 px chỉ thấy góc trên-trái: một mảng
 * nâu phẳng. Hàm này cho hệ số và độ dời đặt một hộp vào GIỮA khung, chừa 10% lề.
 *
 * Không kẹp hệ số: hệ số vừa khung là thứ ĐO được từ khung và nội dung, không phải mức phóng
 * người dùng chọn — kẹp nó ở 0,1 thì mặt bằng 8 m trên điện thoại vẫn tràn khung.
 */

import { degrees, degreesToRadians } from '@/domain/units/types';

/** Một hộp, pixel bản vẽ. */
export interface CanvasFitRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Khổ khung canvas, pixel CSS. */
export interface CanvasFitSize {
  readonly width: number;
  readonly height: number;
}

/** `translate(x, y) scale(zoom)` đặt pixel bản vẽ lên khung. */
export interface CanvasFitView {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** Chừa 10% lề quanh vùng phủ, để đường viền ngoài cùng không dính mép khung. */
export const CANVAS_FIT_MARGIN_RATIO = 0.9;

const HALF = 2;

/** Đặt tâm `centre` (pixel bản vẽ) vào giữa khung ở hệ số `zoom`. */
export const centredCanvasView = (
  frame: CanvasFitSize | null,
  centre: { readonly x: number; readonly y: number },
  zoom: number,
): CanvasFitView => ({
  x: (frame?.width ?? 0) / HALF - centre.x * zoom,
  y: (frame?.height ?? 0) / HALF - centre.y * zoom,
  zoom,
});

/** Khung nhìn phủ vừa `bounds`; `null` khi chưa đo được khung hoặc không có gì để phủ. */
export function fitCanvasView(
  frame: CanvasFitSize | null,
  bounds: CanvasFitRect | null,
): CanvasFitView | null {
  if (frame === null || bounds === null) {
    return null;
  }

  if (frame.width <= 0 || frame.height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }

  const byWidth = (frame.width * CANVAS_FIT_MARGIN_RATIO) / bounds.width;
  const byHeight = (frame.height * CANVAS_FIT_MARGIN_RATIO) / bounds.height;
  const centre = { x: bounds.x + bounds.width / HALF, y: bounds.y + bounds.height / HALF };

  return centredCanvasView(frame, centre, byWidth < byHeight ? byWidth : byHeight);
}

/** Một điểm pixel bản vẽ → pixel khung, theo `view`. */
export const toFramePoint = (
  view: CanvasFitView,
  point: { readonly x: number; readonly y: number },
): { readonly x: number; readonly y: number } => ({
  x: view.x + point.x * view.zoom,
  y: view.y + point.y * view.zoom,
});

/**
 * Một hộp pixel bản vẽ → pixel khung. Lớp phủ HTML (vòng chọn, nhãn đo, ảnh nền) đứng ở hệ này
 * chứ không nằm trong một lớp `scale()` của CSS: ở hệ số 0,08 viền 1,5 px và chữ 12 px của chúng
 * sẽ teo còn chưa tới một pixel, và `vector-effect: non-scaling-stroke` không bù được phép
 * `scale()` của phần tử HTML cha.
 */
export const toFrameRect = (view: CanvasFitView, rect: CanvasFitRect): CanvasFitRect => ({
  ...toFramePoint(view, rect),
  width: rect.width * view.zoom,
  height: rect.height * view.zoom,
});

/** Vùng bản vẽ mà khung đang thấy — `viewBox` của một `<svg>` phủ kín khung. */
export const visibleDrawingRect = (view: CanvasFitView, frame: CanvasFitSize): CanvasFitRect => ({
  x: -view.x / view.zoom,
  y: -view.y / view.zoom,
  width: frame.width / view.zoom,
  height: frame.height / view.zoom,
});

/** Hộp bao trục thẳng của `rect` sau khi xoay `angleDeg` quanh tâm của nó — vòng chọn của ký hiệu xoay. */
export function rotatedBounds(rect: CanvasFitRect, angleDeg: number): CanvasFitRect {
  const radians = degreesToRadians(degrees(angleDeg));
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = rect.width * cos + rect.height * sin;
  const height = rect.width * sin + rect.height * cos;

  return {
    x: rect.x + (rect.width - width) / HALF,
    y: rect.y + (rect.height - height) / HALF,
    width,
    height,
  };
}

/**
 * Where the drawing image sits on the frame (J-10).
 *
 * Wall coordinates are pixels of the scanned image (mm / level scale), so the
 * image must be laid out at its OWN resolution from drawing pixel (0; 0) -
 * the same grid the overlay screen uses. Sizing it from the drawing's stored
 * `widthMm` / `heightMm` (or from the wall bounds while those are missing)
 * shrank and shifted it away from the walls.
 *
 * `surface` is the drawing-pixel box that `surfaceFrame` shows on the frame;
 * `naturalPx` is the image's real size, `null` until it has loaded - then the
 * old box is kept.
 */
export function backgroundFrameRect(
  surface: CanvasFitRect,
  surfaceFrame: CanvasFitRect,
  naturalPx: CanvasFitSize | null,
): CanvasFitRect {
  if (naturalPx === null || surface.width <= 0 || naturalPx.width <= 0 || naturalPx.height <= 0) {
    return surfaceFrame;
  }

  const zoom = surfaceFrame.width / surface.width;

  return {
    x: surfaceFrame.x - surface.x * zoom,
    y: surfaceFrame.y - surface.y * zoom,
    width: naturalPx.width * zoom,
    height: naturalPx.height * zoom,
  };
}
