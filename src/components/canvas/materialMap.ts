/**
 * materialMap.ts
 *
 * NGUỒN THẬT DUY NHẤT cho màu sắc canvas.
 * Mọi component SVG/canvas muốn lấy màu phải gọi hàm từ file này.
 * Cấm đặt hex/rgb/hsl trực tiếp trong component.
 * Cấm gọi `color=` tự do ngoài file này.
 */

import type { WallThickness } from '../../types/spatial';

// ─── Wall ──────────────────────────────────────────────────────────────────

/**
 * Trả về CSS custom property token cho stroke của tường theo độ dày.
 * confidence < 0.75 → caller phải thêm gạch chéo 45° 6%.
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
 * Phần tử có confidence < 0.75 phải hiển thị gạch chéo 45° 6%.
 */
export function isLowConfidence(confidence: number | undefined): boolean {
  if (confidence === undefined) return false;
  return confidence < 0.75;
}
