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
  /** Mặt đất quanh nhà ở chủ đề sáng (thẻ Ánh sáng, nhớ theo dự án). */
  ground: GroundMode;
  /** Hướng nắng: độ xoay đèn chính quanh trục đứng (0–359°, 0 = hướng gốc của chủ đề). */
  sunAzimuth: number;
}

/** `plain` = nền trơn sáng (hợp chung cư, mặc định); `gravel` = sân sỏi; `grass` = bãi cỏ (nhà mặt đất). */
export type GroundMode = 'plain' | 'gravel' | 'grass';

export const DEFAULT_REALISM_FLAGS: RealismFlags = { idle: true, traa: true, hdri: true, materials: true, details: true };

/** Mức người dùng chọn (UI Chất lượng); không có = 'auto'. */
export const TIER_MODE_KEY = 'pascal.realism.tierMode';
/** Mức khởi đầu đã đo ở lần nạp trước (`initTier`), để lần sau dựng pipeline đúng mức ngay. */
export const AUTO_TIER_KEY = 'pascal.realism.autoTier';

const isTier = (v: unknown): v is RealismTier => v === 'low' || v === 'medium' || v === 'high';

/**
 * Mức lúc tạo store, TRƯỚC khi renderer có: mức chọn tay → mức đo lần trước → 'low'. Trước đây
 * cố định 'medium' nên máy iGPU dựng pipeline SSGI rồi dựng lại cho 'low' ở mỗi lần nạp.
 */
export function bootTier(): RealismTier {
  try {
    const mode = window.localStorage.getItem(TIER_MODE_KEY);
    if (isTier(mode)) return mode;
    const cached = window.localStorage.getItem(AUTO_TIER_KEY);
    return isTier(cached) ? cached : 'low';
  } catch {
    return 'low';
  }
}

export const useRealism = create<RealismState>()(() => ({
  backend: 'unknown',
  tier: bootTier(),
  tierMode: 'auto',
  flags: { ...DEFAULT_REALISM_FLAGS },
  ground: 'plain',
  sunAzimuth: 0,
}));

/** Ghi vào store realism từ ngoài thư mục này (thẻ Ánh sáng, test): tuỳ chọn xem, không qua hoàn tác. */
export function setRealism(patch: Partial<RealismState>): void {
  useRealism.setState(patch);
}

/** Giá trị cờ `viewer.realism-*` → `flags` của store (cờ thiếu = mặc định của bảng cờ). */
export function realismFlagsFrom(values: Readonly<Record<string, boolean>>): RealismFlags {
  const on = (key: keyof RealismFlags) => values[`viewer.realism-${key}`] ?? DEFAULT_REALISM_FLAGS[key];
  return { idle: on('idle'), traa: on('traa'), hdri: on('hdri'), materials: on('materials'), details: on('details') };
}
