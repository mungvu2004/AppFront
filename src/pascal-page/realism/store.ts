/**
 * Trạng thái realism chia sẻ giữa trang 3D (`src/pascal-page`) và mã vendor đã vá
 * (nhập qua alias `@pascal-realism/store`). Khoá cố định theo
 * `qa-results/editor-realism/CONTRACT.md`; thẻ khác chỉ THÊM khoá của mình.
 */
import { create } from 'zustand';

export type RealismBackend = 'webgpu' | 'webgl' | 'unknown';
export type RealismTier = 'low' | 'medium' | 'high';

export interface RealismFlags {
  idle: boolean;
  traa: boolean;
  hdri: boolean;
  materials: boolean;
  details: boolean;
}

export interface RealismState {
  /** Backend thật sau khi renderer init. */
  backend: RealismBackend;
  /** Mức chất lượng đang dùng. */
  tier: RealismTier;
  tierMode: 'auto' | RealismTier;
  /** Từ cờ `viewer.realism-*` (main.tsx nạp lúc khởi động). */
  flags: RealismFlags;
}

export const DEFAULT_REALISM_FLAGS: RealismFlags = { idle: true, traa: true, hdri: true, materials: true, details: true };

export const useRealism = create<RealismState>()(() => ({
  backend: 'unknown',
  tier: 'medium',
  tierMode: 'auto',
  flags: { ...DEFAULT_REALISM_FLAGS },
}));

/** Giá trị cờ `viewer.realism-*` → `flags` của store (cờ thiếu = bật, như mặc định bảng cờ). */
export function realismFlagsFrom(values: Readonly<Record<string, boolean>>): RealismFlags {
  const on = (key: keyof RealismFlags) => values[`viewer.realism-${key}`] !== false;
  return { idle: on('idle'), traa: on('traa'), hdri: on('hdri'), materials: on('materials'), details: on('details') };
}
