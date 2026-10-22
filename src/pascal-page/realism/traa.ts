/**
 * R3 (GĐ3): viewport có TRAA không. Đọc lúc dựng pipeline (`post-processing.tsx` đã vá),
 * đổi cờ phải dựng lại pipeline. `?disable=traa` tắt để so A/B như các cờ `?disable=` khác.
 */
import { useRealism } from './store';

export function traaEnabledFor(flagOn: boolean, search: string): boolean {
  const disable = new URLSearchParams(search).get('disable') ?? '';
  return flagOn && !disable.split(',').includes('traa');
}

export function traaEnabled(): boolean {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return traaEnabledFor(useRealism.getState().flags.traa, search);
}
