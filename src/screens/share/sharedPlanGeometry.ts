/**
 * Hình học thuần của mặt bằng chỉ đọc trên trang chia sẻ: khung vừa bản vẽ, phóng/kéo, chỗ đặt
 * tên phòng, đoạn cửa trên tường. Không DOM, không React, để test được bằng số.
 *
 * Đơn vị là đơn vị của đồ thị (mm sau hiệu chỉnh, có khi vẫn là pixel ảnh). Mọi khoảng đệm và cỡ
 * chữ vì thế tính theo tỉ lệ kích thước bản vẽ, không theo một số mm cố định (U23: đệm 500 cố định
 * làm một bản vẽ 600 đơn vị co còn ~300 px giữa màn).
 */
import { computeCentroid, computeLargestInnerRectangle } from '@/domain/rooms/area';
import type { Opening, Point, Room, Wall } from '@/domain/spatial/types';
import { millimetres } from '@/domain/units/types';

export interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Tâm đang nhìn và độ phóng so với khung vừa bản vẽ (1 = vừa khung). */
export interface PlanCamera {
  readonly cx: number;
  readonly cy: number;
  readonly zoom: number;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 20;
const PAD_RATIO = 0.06;

/** Khung bao tường + phòng, đệm 6% cạnh dài. `null` khi tầng trống. */
export function fitViewBox(walls: readonly Wall[], rooms: readonly Room[]): ViewBox | null {
  const points: Point[] = [
    ...walls.flatMap((wall) => [wall.centreline.start, wall.centreline.end]),
    ...rooms.flatMap((room) => room.outline),
  ];
  if (points.length === 0) {
    return null;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const pad = Math.max(width, height, 1) * PAD_RATIO;

  return { x: minX - pad, y: minY - pad, w: width + 2 * pad, h: height + 2 * pad };
}

export function fitCamera(fit: ViewBox): PlanCamera {
  return { cx: fit.x + fit.w / 2, cy: fit.y + fit.h / 2, zoom: 1 };
}

export function cameraViewBox(fit: ViewBox, camera: PlanCamera): ViewBox {
  const w = fit.w / camera.zoom;
  const h = fit.h / camera.zoom;

  return { x: camera.cx - w / 2, y: camera.cy - h / 2, w, h };
}

/** Phóng theo hệ số `factor` (>1 là phóng to), giữ điểm `at` đứng yên dưới con trỏ nếu có. */
export function zoomCamera(camera: PlanCamera, factor: number, at?: { x: number; y: number }): PlanCamera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  if (at === undefined) {
    return { ...camera, zoom };
  }
  const keep = camera.zoom / zoom;

  return { cx: at.x - (at.x - camera.cx) * keep, cy: at.y - (at.y - camera.cy) * keep, zoom };
}

/** Kéo bản vẽ theo `dx, dy` đơn vị đồ thị (bản vẽ đi theo tay, nên tâm đi ngược lại). */
export function panCamera(camera: PlanCamera, dx: number, dy: number): PlanCamera {
  return { ...camera, cx: camera.cx - dx, cy: camera.cy - dy };
}

/** Chỗ đặt tên phòng: tâm hộp rỗng lớn nhất trong phòng (phòng chữ L không đẩy tên ra ngoài). */
export function roomLabelAnchor(room: Room): { x: number; y: number; width: number } {
  const outline = room.outline.map((p) => ({ x: millimetres(p.x), y: millimetres(p.y) }));
  const box = computeLargestInnerRectangle(outline);
  if (box === null) {
    const centroid = computeCentroid(outline);
    return { x: centroid.x, y: centroid.y, width: 0 };
  }

  return { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, width: box.widthMm };
}

/** U43: tên phòng viết hoa chữ đầu ("phòng ngủ 01" → "Phòng ngủ 01") cho người xem ngoài. */
export function roomDisplayName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toLocaleUpperCase('vi') + trimmed.slice(1);
}

/** Đoạn của ô mở trên tim tường: từ `offsetMm` tới `offsetMm + widthMm` tính từ đầu tường. */
export function openingSegment(wall: Wall, opening: Opening): { start: Point; end: Point } | null {
  const { start, end } = wall.centreline;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) {
    return null;
  }
  const at = (distance: number): Point => {
    const t = Math.min(1, Math.max(0, distance / length));
    return { x: millimetres(start.x + (end.x - start.x) * t), y: millimetres(start.y + (end.y - start.y) * t) };
  };

  return { start: at(opening.offsetMm), end: at(opening.offsetMm + opening.widthMm) };
}
