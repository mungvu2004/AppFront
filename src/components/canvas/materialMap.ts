/**
 * materialMap.ts
 *
 * NGUỒN THẬT DUY NHẤT cho màu sắc canvas.
 * Mọi component SVG/canvas muốn lấy màu phải gọi hàm từ file này.
 * Cấm đặt hex/rgb/hsl trực tiếp trong component.
 * Cấm gọi `color=` tự do ngoài file này.
 */

import { confidenceLevel, type ConfidenceLevel } from '@/lib/format/semantic';
import type { MaybeNumber } from '@/lib/format/number';

import type { WallThickness } from '../../types/spatial';

// ─── Wall ──────────────────────────────────────────────────────────────────

/**
 * Trả về CSS custom property token cho stroke của tường theo độ dày.
 * Mức "cần kiểm tra" → caller phải thêm gạch chéo 45° 6%; xem `isLowConfidence`.
 */
/** Bậc độ dày → ba token màu: ≤150 mỏng, ≤220 vừa, còn lại dày. */
export function wallThicknessColorBand(thicknessMm: number): 110 | 220 | 330 {
  if (thicknessMm <= 150) return 110;
  return thicknessMm <= 220 ? 220 : 330;
}

export function wallStrokeToken(thickness: WallThickness): string {
  if (typeof thickness === 'number' && !Number.isFinite(thickness)) return 'var(--wall-idle)';
  switch (typeof thickness === 'number' ? wallThicknessColorBand(thickness) : thickness) {
    case 110:
      return 'var(--wall-110-stroke)'; // ≥ 3:1 trên canvas ở cả hai chủ đề (globals.css)
    case 220:
      return 'var(--wall-220)';
    case 330:
      return 'var(--wall-330-stroke)';
    case 'CONCRETE_COLUMN':
      return 'var(--text-primary)';
    default:
      return 'var(--wall-idle)';
  }
}

/**
 * Trả về CSS custom property token cho fill của tường (thường dùng với opacity thấp).
 */
export function wallFillToken(thickness: WallThickness): string {
  // Fill dùng cùng token stroke nhưng caller dùng opacity thấp hơn
  return wallStrokeToken(thickness);
}

// ─── Room ──────────────────────────────────────────────────────────────────

/**
 * Token nền phòng — tô với opacity 5%.
 */
export function roomFillToken(): string {
  return 'var(--bg-sunken)';
}

export function roomStrokeToken(): string {
  return 'var(--border-default)';
}

// ─── Door ──────────────────────────────────────────────────────────────────

export function doorStrokeToken(): string {
  return 'var(--accent)';
}

export function doorFillToken(): string {
  return 'var(--accent-wash)';
}

// ─── Window ────────────────────────────────────────────────────────────────

export function windowStrokeToken(): string {
  return 'var(--text-secondary)';
}

// ─── Furniture ─────────────────────────────────────────────────────────────

export function furnitureStrokeToken(): string {
  return 'var(--text-muted)';
}

export function furnitureFillToken(): string {
  return 'var(--bg-sunken)';
}

// ─── Dimension ─────────────────────────────────────────────────────────────

export function dimensionStrokeToken(): string {
  return 'var(--accent)';
}

export function dimensionTextToken(): string {
  return 'var(--text-primary)';
}

// ─── Grid ──────────────────────────────────────────────────────────────────

export function gridMinorToken(): string {
  return 'var(--canvas-2d-grid)';
}

export function gridMajorToken(): string {
  return 'var(--border-default)';
}

// ─── Transform Gizmo Axes ──────────────────────────────────────────────────
// Dùng thang xám ấm — KHÔNG dùng màu bão hoà (đỏ/xanh/vàng).

export function axisStrokeToken(axis: 'x' | 'y' | 'z'): string {
  switch (axis) {
    case 'x':
      return 'var(--wall-330)'; // tối nhất trong thang xám ấm
    case 'y':
      return 'var(--wall-220)'; // giữa
    case 'z':
      return 'var(--wall-110)'; // sáng nhất
    default:
      return 'var(--text-muted)';
  }
}

// ─── Selection ─────────────────────────────────────────────────────────────

export function selectionBorderToken(): string {
  return 'var(--accent)';
}

export function selectionFillToken(): string {
  return 'var(--accent-wash)';
}

/**
 * Viền tách 1 px màu nền canvas quanh viền chọn (bốn bóng sắc, không nhoè): viền `--accent` không
 * bao giờ chìm vào ruột tường, kể cả khi màu tường gần màu nhấn (bảng "Chì và nâu đất").
 */
export const SELECTION_SEPARATOR_FILTER =
  'drop-shadow(1px 0 0 var(--wall-conf-cut)) drop-shadow(-1px 0 0 var(--wall-conf-cut)) drop-shadow(0 1px 0 var(--wall-conf-cut)) drop-shadow(0 -1px 0 var(--wall-conf-cut))';

// ─── Confidence ────────────────────────────────────────────────────────────

/**
 * Phần tử ở mức "cần kiểm tra" phải hiển thị gạch chéo 45° 6%.
 *
 * Ngưỡng lấy từ `confidenceLevel` trong `@/lib/format/semantic` chứ không tự đặt
 * con số. Trước đây file này dùng 0,75 riêng, nằm giữa dải "AI đề xuất"
 * (0,70–0,90), nên một phần tử ghi "AI đề xuất" ở 0,72 thì có gạch chéo còn 0,78
 * thì không — cùng một nhãn, hai cách vẽ. Nay ranh giới của nét vẽ trùng đúng
 * ranh giới của nhãn: chỉ mức `needsReview` (< 0,70) mới bị gạch.
 *
 * Không có điểm số nào là `verified` — màu xanh đó thuộc về người duyệt (A5).
 * Thiếu điểm số (`undefined`, `null`, `NaN`) là mức `unknown`, không gạch chéo:
 * "chưa có điểm" khác với "điểm thấp".
 */
export function isLowConfidence(confidence: MaybeNumber): boolean {
  return confidenceLevel(confidence) === 'needsReview';
}

/** Bậc tin cậy của một tường trên canvas: bốn mức của máy, cộng "đã duyệt" (chỉ người duyệt — A5). */
export type WallConfidenceTier = ConfidenceLevel | 'reviewed';

/**
 * Màu tô tường theo bậc tin cậy (thay cho màu theo độ dày — độ dày đã đọc được từ bề rộng thật của
 * đa giác). Không đổi nghĩa `wallStrokeToken`. Thiếu điểm (`unknown`) giữ xám trung tính.
 */
export function wallConfidenceToken(tier: WallConfidenceTier): string {
  switch (tier) {
    case 'certain':
      return 'var(--wall-conf-high)';
    case 'suggested':
      return 'var(--wall-conf-mid)';
    case 'needsReview':
      return 'var(--wall-conf-low)';
    case 'reviewed':
      return 'var(--state-verified)';
    default:
      return 'var(--wall-220)';
  }
}

/**
 * Mép khắc của tường CHƯA CHẮC: nét 2 px màu nền canvas, gạch 1 px cách 4 px, không co giãn theo
 * phóng. Nửa nét nằm trong đa giác nên mỗi vết khắc ăn ~1 px mép ruột — ruột vẫn đặc, không phải
 * tường rỗng/nét đứt. Tín hiệu không-màu cho người khó phân biệt màu (cùng gạch chéo + chấm vàng).
 */
export const WALL_LOW_EDGE_CUT = {
  stroke: 'var(--wall-conf-cut)',
  strokeWidth: 2,
  strokeDasharray: '1 4',
  strokeLinecap: 'butt',
  strokeLinejoin: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const;
