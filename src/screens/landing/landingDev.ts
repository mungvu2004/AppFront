/**
 * Phần phụ của useLandingScroll: lưu/đọc chỗ cuộn (khôi phục khi back/forward) và các hook chỉ có ở
 * bản dev (`?lerp=&k=`, `?quality=`, `window.__landing*`).
 */

import { SCROLL_FEEL } from '@/lib/landing/stage/quality';

const SCROLL_KEY = 'landing:scrollY';
export const store = (y: number): void => {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(y));
  } catch {
    /* chế độ riêng tư: bỏ qua, chỉ mất khôi phục cuộn */
  }
};
export const saved = (): number => {
  try {
    return Number(sessionStorage.getItem(SCROLL_KEY)) || 0;
  } catch {
    return 0;
  }
};

declare global {
  interface Window {
    /** Chỉ bản dev: cuộn tức thì tới `p` và chờ hai khung đã vẽ. */
    __landingSeek?: (p: number) => Promise<void>;
    /** Chỉ bản dev: resolve sau khung đầu tiên của stage. */
    __landingReady?: Promise<void>;
    /** Chỉ bản dev: p thô, p đang vẽ (sau tầng giảm chấn), số khung đã vẽ, khung trung vị của benchmark. */
    __landingP?: () => { raw: number; shown: number; frames: number; bench: number | null };
  }
}

/** Chỉ bản dev: `?lerp=0.1&k=8` để A/B cảm giác cuộn (tools/feel.mjs). */
export function devFeel(): { lerp: number; k: number } {
  const q = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const lerp = Number(q?.get('lerp'));
  const k = Number(q?.get('k'));
  return { lerp: lerp > 0 ? lerp : SCROLL_FEEL.lerp, k: k > 0 ? k : SCROLL_FEEL.k };
}

/** Chỉ bản dev: `?quality=full|balanced|lite` để đo từng bậc. */
export function devQuality(): 'full' | 'balanced' | 'lite' | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(location.search).get('quality');
  return q === 'full' || q === 'balanced' || q === 'lite' ? q : null;
}
