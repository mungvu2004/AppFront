/**
 * Phép chiếu và hằng số dựng hình của canvas xem trước màn "Chuẩn hoá độ dày
 * tường" — file `.ts` THUẦN, không một thẻ JSX nào, không React, không
 * `src/api`/`src/store`/`src/domain`/`src/lib/http`.
 *
 * Đúng khuôn `roomLabelCanvasGeometry.ts` của `RoomLabelReview` và
 * `wallLayerHatch.ts` của `WallLayerReview`: mục D của `CLAUDE.md` nói "tính
 * toán không nằm trong màn hình", nên phần tính nằm ở một module anh em trong
 * chính thư mục màn, còn `.tsx` chỉ gọi rồi vẽ.
 *
 * ## Vì sao canvas này phải TỰ chiếu, và vì sao đó không phải hình học nghiệp vụ
 *
 * `ThicknessPreviewCanvasProps` (đóng băng, T4) chỉ cấp
 * {@link ThicknessWallShapeViewModel.outline} — đa giác đã tính sẵn, theo toạ
 * độ mô hình — và KHÔNG cấp `viewport`/`drawingSizePx`/`millimetresPerPixel`
 * nào. Cột phải lại rộng cố định {@link THICKNESS_PREVIEW_CANVAS_WIDTH_PX}.
 * Nên để một đa giác 45 m nằm vừa một khung 320 px, phải có đúng một phép
 * chiếu: hộp bao của toàn bộ nội dung, một tỉ lệ đồng nhất, và một khoảng lệch
 * căn giữa. Đó là `object-fit: contain` viết tay — không tính diện tích, không
 * tính giao điểm, không tính pháp tuyến, không đụng một quy tắc không gian nào
 * của `src/domain`.
 *
 * Phép chiếu này phục vụ HAI nơi cùng lúc, và đó là lý do nó phải là một hàm
 * dùng chung chứ không phải `viewBox` của thẻ `<svg>`: đa giác vẽ bằng SVG,
 * còn `SelectionHalo` là một `<div>` tuyệt đối cần `x`/`y`/`width`/`height`
 * bằng PIXEL của khung. Hai lớp đó chỉ chồng khít nhau nếu chúng đọc chung một
 * tỉ lệ — `viewBox` sẽ cho SVG một tỉ lệ mà lớp HTML không biết.
 */

import type { ThicknessWallShapeViewModel } from './thicknessTypes';
import { THICKNESS_PREVIEW_CANVAS_WIDTH_PX } from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Kích thước khung — mọi con số vẽ đều có tên ở đây, không rải trong JSX.     */
/* -------------------------------------------------------------------------- */

/**
 * Chiều cao khung xem trước, px.
 *
 * Thấp hơn bề rộng: đây là "xem trước phụ, giữ ngữ cảnh không gian", không phải
 * chỗ thao tác chính, nên nó không được chiếm chiều cao của biểu đồ và hai bảng
 * bên cạnh. Cùng bậc với chiều cao vùng vẽ biểu đồ (`HISTOGRAM_HEIGHT_PX`) cộng
 * chỗ cho chú giải nổi ở góc trái dưới.
 */
export const THICKNESS_PREVIEW_CANVAS_HEIGHT_PX = 260;

/** Đệm quanh nội dung, px — đa giác sát mép trông như bị cắt cụt. */
export const THICKNESS_PREVIEW_PADDING_PX = 16;

/** Bề dày nét viền một đa giác tường, px. */
export const WALL_OUTLINE_STROKE_WIDTH_PX = 1;

/** Độ mờ nền một tường bình thường. */
export const WALL_FILL_OPACITY = 0.55;

/** Độ mờ nền một tường KHÔNG khớp thứ đang trỏ tới — mờ đi để nhóm khớp nổi lên. */
export const WALL_FILL_OPACITY_DIMMED = 0.18;

/** Độ mờ nền một tường khớp thứ đang trỏ tới. */
export const WALL_FILL_OPACITY_MATCHED = 0.9;

/* -------------------------------------------------------------------------- */
/* Kiểu.                                                                       */
/* -------------------------------------------------------------------------- */

/** Một điểm phẳng, đơn vị PIXEL của khung xem trước. */
export interface ThicknessPointPx {
  readonly x: number;
  readonly y: number;
}

/** Hộp bao trục thẳng, đơn vị pixel của khung xem trước. */
export interface ThicknessBoundsPx {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Phép chiếu toạ độ mô hình → pixel khung: một tỉ lệ đồng nhất cộng một khoảng
 * lệch. Đồng nhất cả hai trục nên hình không bị bóp méo.
 */
export interface ThicknessPreviewProjection {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

/* -------------------------------------------------------------------------- */
/* Hộp bao.                                                                    */
/* -------------------------------------------------------------------------- */

function boundsOfPoints(points: readonly ThicknessPointPx[]): ThicknessBoundsPx | null {
  if (points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Hộp bao của TOÀN BỘ đa giác, theo toạ độ mô hình. `null` khi chưa có tường nào. */
export function computeModelBounds(
  shapes: readonly ThicknessWallShapeViewModel[],
): ThicknessBoundsPx | null {
  return boundsOfPoints(shapes.flatMap((shape) => [...shape.outline]));
}

/* -------------------------------------------------------------------------- */
/* Phép chiếu.                                                                 */
/* -------------------------------------------------------------------------- */

/** Tỉ lệ dùng khi chưa có gì để đo — giữ toạ độ nguyên vẹn thay vì nhân với 0. */
const NEUTRAL_SCALE = 1;

/** Một nửa, để chia phần thừa đều sang hai bên khi căn giữa. */
const HALF = 2;

/**
 * Tỉ lệ và khoảng lệch để toàn bộ đa giác nằm gọn, căn giữa, trong khung
 * `widthPx` × `heightPx` — có đệm {@link THICKNESS_PREVIEW_PADDING_PX} hai bên.
 *
 * Không có tường nào, hoặc mọi tường trùng một điểm, thì tỉ lệ về
 * {@link NEUTRAL_SCALE}: phóng to vô hạn một hộp bao rỗng là cách nhanh nhất để
 * ra `NaN` trong thuộc tính `points`, thứ khiến cả thẻ `<svg>` biến mất mà
 * không báo lỗi ở đâu cả.
 */
export function computeProjection(
  shapes: readonly ThicknessWallShapeViewModel[],
  widthPx: number,
  heightPx: number,
): ThicknessPreviewProjection {
  const usableWidth = Math.max(widthPx - THICKNESS_PREVIEW_PADDING_PX * HALF, 0);
  const usableHeight = Math.max(heightPx - THICKNESS_PREVIEW_PADDING_PX * HALF, 0);
  const bounds = computeModelBounds(shapes);

  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) {
    return {
      scale: NEUTRAL_SCALE,
      offsetX: THICKNESS_PREVIEW_PADDING_PX,
      offsetY: THICKNESS_PREVIEW_PADDING_PX,
      widthPx,
      heightPx,
    };
  }

  const scale = Math.min(usableWidth / bounds.width, usableHeight / bounds.height);

  return {
    scale,
    offsetX:
      THICKNESS_PREVIEW_PADDING_PX + (usableWidth - bounds.width * scale) / HALF - bounds.x * scale,
    offsetY:
      THICKNESS_PREVIEW_PADDING_PX +
      (usableHeight - bounds.height * scale) / HALF -
      bounds.y * scale,
    widthPx,
    heightPx,
  };
}

/** Phép chiếu của cột xem trước rộng {@link THICKNESS_PREVIEW_CANVAS_WIDTH_PX}. */
export function computePreviewProjection(
  shapes: readonly ThicknessWallShapeViewModel[],
): ThicknessPreviewProjection {
  return computeProjection(
    shapes,
    THICKNESS_PREVIEW_CANVAS_WIDTH_PX,
    THICKNESS_PREVIEW_CANVAS_HEIGHT_PX,
  );
}

/** Một điểm của mô hình, ra pixel khung. */
export function projectPoint(
  point: { readonly x: number; readonly y: number },
  projection: ThicknessPreviewProjection,
): ThicknessPointPx {
  return {
    x: point.x * projection.scale + projection.offsetX,
    y: point.y * projection.scale + projection.offsetY,
  };
}

/** Đa giác của một tường, ra pixel khung. */
export function projectOutline(
  outline: readonly { readonly x: number; readonly y: number }[],
  projection: ThicknessPreviewProjection,
): readonly ThicknessPointPx[] {
  return outline.map((corner) => projectPoint(corner, projection));
}

/** Chuỗi `points` cho thẻ `<polygon>` — không một phép hình học nào thêm. */
export function svgPointsAttr(points: readonly ThicknessPointPx[]): string {
  return points.map((point) => `${String(point.x)},${String(point.y)}`).join(' ');
}

/**
 * Hộp bao PIXEL của một tường — đúng thứ `SelectionHalo` cần để bám vào, và lý
 * do phép chiếu phải dùng chung với lớp SVG (xem đầu file).
 */
export function projectedBoundsOf(
  shape: ThicknessWallShapeViewModel,
  projection: ThicknessPreviewProjection,
): ThicknessBoundsPx {
  return (
    boundsOfPoints(projectOutline(shape.outline, projection)) ?? {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }
  );
}
