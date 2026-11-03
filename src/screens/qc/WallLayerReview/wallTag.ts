/**
 * Nhãn nhỏ của tường đang chọn/rê (WRU-B): một đường dẫn 1 px từ giữa tim tường tới chip
 * "3.450 × 220 mm · Máy chắc chắn". Toàn bộ hình học ở đây (R-60: view chỉ vẽ), mọi toạ độ là
 * pixel KHUNG như nhãn đo — không teo theo hệ số phóng (BUG-403).
 */

import { toFramePoint } from '../shared/canvasFit';

import type { WallLayerCanvasShape, WallLayerSizePx, WallTagView } from './wallLayerHatch';
import { WALL_CONFIDENCE_TIER_TEXT } from './wallLayerHatch';
import type { WallRowExtra } from './wallReviewQueue';

interface PointPx { readonly x: number; readonly y: number }

/** Chip cách tim tường bao xa theo pháp tuyến. */
export const WALL_TAG_OFFSET_PX = 32;
/** Thẻ thông tin neo mép phải khung (~300 px + lề 24) — chip không đè lên nó. */
export const WALL_TAG_RIGHT_RESERVE_PX = 324;
export const WALL_TAG_TOP_RESERVE_PX = 60;
export const WALL_TAG_BOTTOM_RESERVE_PX = 12;
/** Nửa cỡ ước của chip (chữ mono 12 px ~30 ký tự) — kẹp tâm chip để cả chip nằm trong khung. */
const TAG_HALF_WIDTH_PX = 110;
const TAG_HALF_HEIGHT_PX = 12;
const EDGE_PX = 4;
const MISSING = '–';

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Neo = trung điểm tim tường; chip = neo + pháp tuyến × 32 px, về phía XA thẻ thông tin bên phải
 * (tường đứng → sang trái; tường nằm → lên trên), rồi kẹp trong khung trừ phần thẻ phải, 60 px trên,
 * 12 px dưới. Neo ra ngoài khung (tường cuộn khỏi tầm nhìn) → `null`, không vẽ đường dẫn tới hư không.
 */
export function placeWallTag(
  start: PointPx,
  end: PointPx,
  frame: WallLayerSizePx,
): { readonly anchorPx: PointPx; readonly tagPx: PointPx } | null {
  const anchorPx = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  if (anchorPx.x < 0 || anchorPx.y < 0 || anchorPx.x > frame.width || anchorPx.y > frame.height) {
    return null;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const normal = length === 0 ? { x: 0, y: -1 } : { x: -dy / length, y: dx / length };
  const towardLeftOrUp = Math.abs(normal.x) >= 0.5 ? normal.x < 0 : normal.y < 0;
  const sign = towardLeftOrUp ? 1 : -1;

  return {
    anchorPx,
    tagPx: {
      x: clamp(
        anchorPx.x + sign * normal.x * WALL_TAG_OFFSET_PX,
        EDGE_PX + TAG_HALF_WIDTH_PX,
        frame.width - WALL_TAG_RIGHT_RESERVE_PX - EDGE_PX - TAG_HALF_WIDTH_PX,
      ),
      y: clamp(
        anchorPx.y + sign * normal.y * WALL_TAG_OFFSET_PX,
        WALL_TAG_TOP_RESERVE_PX + TAG_HALF_HEIGHT_PX,
        frame.height - WALL_TAG_BOTTOM_RESERVE_PX - TAG_HALF_HEIGHT_PX,
      ),
    },
  };
}

/** Nhãn của một tường: tim tường đổi ra pixel khung, chữ dài × dày lấy từ phần thêm của hàng đợi (đã định dạng). */
export function wallTagOf(
  shape: WallLayerCanvasShape,
  extra: Pick<WallRowExtra, 'lengthText' | 'thicknessText'> | undefined,
  viewport: Parameters<typeof toFramePoint>[0],
  frame: WallLayerSizePx,
): WallTagView | null {
  const placed = placeWallTag(toFramePoint(viewport, shape.centrelinePx.start), toFramePoint(viewport, shape.centrelinePx.end), frame);

  if (placed === null) {
    return null;
  }

  return {
    ...placed,
    text: `${extra?.lengthText ?? MISSING} × ${extra?.thicknessText ?? MISSING} mm · ${WALL_CONFIDENCE_TIER_TEXT[shape.confidenceTier]}`,
    tier: shape.confidenceTier,
  };
}
