/**
 * materialMap.ts
 *
 * NGUỒN THẬT DUY NHẤT cho màu sắc canvas.
 * Mọi component SVG/canvas muốn lấy màu phải gọi hàm từ file này.
 * Cấm đặt hex/rgb/hsl trực tiếp trong component.
 * Cấm gọi `color=` tự do ngoài file này.
 */

import { confidenceLevel } from '@/lib/format/semantic';
import type { MaybeNumber } from '@/lib/format/number';

import type { WallThickness } from '../../types/spatial';

// ─── Wall ──────────────────────────────────────────────────────────────────

/**
 * Trả về CSS custom property token cho stroke của tường theo độ dày.
 * Mức "cần kiểm tra" → caller phải thêm gạch chéo 45° 6%; xem `isLowConfidence`.
 */
export function wallStrokeToken(thickness: WallThickness): string {
  switch (thickness) {
    case 110:
      return 'var(--wall-110)';
    case 220:
      return 'var(--wall-220)';
    case 330:
      return 'var(--wall-330)';
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
// Dùng thang xám ấm — KHÔNG dùng màu bão hòa (đỏ/xanh/vàng).

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
