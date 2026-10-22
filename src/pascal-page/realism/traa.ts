/**
 * R3 (GĐ3): viewport có TRAA không. Đọc lúc dựng pipeline (`post-processing.tsx` đã vá),
 * đổi cờ phải dựng lại pipeline. `?disable=traa` tắt để so A/B như các cờ `?disable=` khác.
 */
import { useRealism } from './store';

/** F3: bán kính denoise AO khi TRAA. Đã thử 0 (bỏ denoise) và 2: còn hạt dưới chân ghế → giữ 4, bù bằng ao^k. */
export const TRAA_AO_DENOISE_RADIUS = 4;
/** F3: đậm AO thêm chút khi TRAA (ao^k, k > 1) cho bóng chân đồ/góc trần gần ảnh không TRAA. */
export const TRAA_AO_POW = 2;

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
