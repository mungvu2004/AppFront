/**
 * R3 (GĐ3): viewport có TRAA không. Đọc lúc dựng pipeline (`post-processing.tsx` đã vá),
 * đổi cờ phải dựng lại pipeline. `?disable=traa` tắt để so A/B như các cờ `?disable=` khác.
 */
import { useRealism } from './store';

/** F3: TRAA + SSGI lọc thời gian đã tự khử hạt AO → bỏ denoise không gian của AO (nó xoá bóng tiếp xúc). */
export const TRAA_AO_DENOISE = false;
/** F3: đậm AO thêm chút khi TRAA (ao^k, k > 1) cho bóng chân đồ/góc trần gần ảnh không TRAA. */
export const TRAA_AO_POW = 1.25;

export function traaEnabledFor(flagOn: boolean, search: string): boolean {
  const disable = new URLSearchParams(search).get('disable') ?? '';
  return flagOn && !disable.split(',').includes('traa');
}

export function traaEnabled(): boolean {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const { flags, tier } = useRealism.getState();
  // F3: mức low dùng lại MSAA như cũ (TRAA + velocity tốn thêm trên máy yếu).
  return tier !== 'low' && traaEnabledFor(flags.traa, search);
}
