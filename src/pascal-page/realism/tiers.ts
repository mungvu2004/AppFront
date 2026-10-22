/**
 * R3T: mức chất lượng của viewport, tự hạ mức khi chậm, dựng lại canvas khi mất thiết bị.
 * Vendor đọc qua `@pascal-realism/tiers` (luật `scripts/realism/r3t-tiers.mjs`).
 *
 * Ghép với `renderLook.ts`: `applyRenderLook` đè `RENDER_LOOK_SSGI` lên `SSGI_PARAMS` (dáng chung,
 * cũng dùng cho ảnh chụp). Lúc dựng pipeline vendor đọc `tierSsgi(tier, SSGI_PARAMS)`: tier là nguồn
 * CUỐI — `medium` giữ nguyên SSGI_PARAMS (= dáng hôm nay), `high` đè số lát/bước, `low` không dựng
 * hậu kỳ nào (disablePostFx).
 */
import { create } from 'zustand';

import { backendOf } from './backend';
import { useRealism, type RealismTier } from './store';
import { emitRealism } from './telemetry';

export interface TierConfig {
  /** false = không dựng chuỗi hậu kỳ (vẽ thẳng `renderer.render`). */
  postFx: boolean;
  /** Đè số lát/bước SSGI; không có = giữ `SSGI_PARAMS`. */
  ssgi?: { sliceCount: number; stepCount: number };
  dprMax: number;
  shadow: number;
}

// `medium` = đúng hành vi trước R3T (SSGI 2×8 của renderLook, DPR 1.5, bóng 2048) để dGPU không đổi mặt.
export const TIERS: Record<RealismTier, TierConfig> = {
  low: { postFx: false, dprMax: 1, shadow: 1024 },
  medium: { postFx: true, dprMax: 1.5, shadow: 2048 },
  high: { postFx: true, ssgi: { sliceCount: 3, stepCount: 16 }, dprMax: 2, shadow: 2048 },
};

const ORDER: RealismTier[] = ['low', 'medium', 'high'];
export const FRAME_BUDGET_MS = 20;
export const SLOW_SECONDS = 5;
/** Bỏ qua mẫu lúc đầu / sau khi đổi mức (biên dịch shader khựng tới ~3,6 s, R-R0). */
export const WARMUP_MS = 8000;

export const tierConfig = (tier: RealismTier): TierConfig => TIERS[tier];
/** Hook cho vendor: mức đang dùng. */
export const useTier = (): RealismTier => useRealism((s) => s.tier);

export function tierSsgi<T extends { sliceCount: number; stepCount: number }>(tier: RealismTier, base: T): T {
  const over = TIERS[tier].ssgi;
  return over ? { ...base, ...over } : base;
}

export const lowerTier = (tier: RealismTier): RealismTier => ORDER[Math.max(0, ORDER.indexOf(tier) - 1)]!;

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

/**
 * Hàm thuần: `secondP95s` = p95 của từng giây gần nhất (cũ → mới). Hạ một mức khi
 * `SLOW_SECONDS` giây cuối đều vượt ngân sách; không bao giờ tự nâng.
 */
export function autoTier(tier: RealismTier, secondP95s: readonly number[]): RealismTier {
  const last = secondP95s.slice(-SLOW_SECONDS);
  return last.length === SLOW_SECONDS && last.every((ms) => ms > FRAME_BUDGET_MS) ? lowerTier(tier) : tier;
}

interface AdapterInfoLike {
  vendor?: string;
  architecture?: string;
  description?: string;
  device?: string;
  isFallbackAdapter?: boolean;
}

/** Mức khởi đầu: WebGL hoặc GPU tích hợp/fallback → low, còn lại medium. */
export function initialTier(backend: 'webgpu' | 'webgl' | 'unknown', info: AdapterInfoLike | undefined): RealismTier {
  if (backend === 'webgl') return 'low';
  if (!info) return 'medium';
  if (info.isFallbackAdapter) return 'low';
  const text = `${info.vendor ?? ''} ${info.architecture ?? ''} ${info.description ?? ''} ${info.device ?? ''}`.toLowerCase();
  return /intel|integrated|swiftshader|llvmpipe|basic render/.test(text) ? 'low' : 'medium';
}

/* --------------------------- trạng thái + vòng đo --------------------------- */

const MODE_KEY = 'pascal.realism.tierMode';
type TierMode = 'auto' | RealismTier;

function readMode(): TierMode {
  try {
    const v = window.localStorage.getItem(MODE_KEY);
    return v === 'low' || v === 'medium' || v === 'high' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/** Đếm số lần mất thiết bị → `key` của <Canvas> (đổi key = dựng lại renderer). */
export const useDeviceEpoch = create<{ epoch: number }>()(() => ({ epoch: 0 }));

let tierSince = 0;
function setTier(to: RealismTier, auto: boolean): void {
  const from = useRealism.getState().tier;
  tierSince = performance.now();
  if (from === to) return;
  useRealism.setState({ tier: to });
  emitRealism({ name: 'viewer.tier_change', from, to, auto });
}

/** Người dùng chọn mức (UI); 'auto' trả về mức khởi đầu đã đo. Nhớ theo máy. */
let autoStart: RealismTier = 'medium';
export function setTierMode(mode: TierMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // không lưu được thì thôi
  }
  useRealism.setState({ tierMode: mode });
  setTier(mode === 'auto' ? autoStart : mode, false);
}

let started = false;
/** Vendor `GPUDeviceWatcher` gọi khi renderer có (mỗi lần mount); chỉ lần đầu chọn mức + chạy vòng đo. */
export function initTier(renderer: unknown): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const backend = (renderer as { backend?: { device?: { adapterInfo?: AdapterInfoLike } } } | null)?.backend;
  autoStart = initialTier(backendOf(renderer), backend?.device?.adapterInfo);
  const mode = readMode();
  useRealism.setState({ tierMode: mode });
  setTier(mode === 'auto' ? autoStart : mode, mode === 'auto');
  startLoop();
}

/** Vendor gọi khi `device.lost` (không gọi khi lý do 'destroyed' = ta tự huỷ). */
export function onDeviceLost(info: { reason?: string | null } | undefined): void {
  if (info?.reason === 'destroyed') return;
  setTier('low', true);
  useDeviceEpoch.setState((s) => ({ epoch: s.epoch + 1 }));
}

const P95_EVERY_MS = 60_000;

function startLoop(): void {
  let last = performance.now();
  let second: number[] = [];
  let minute: number[] = [];
  let secondStart = last;
  let minuteStart = last;
  const p95s: number[] = [];
  const tick = (now: number) => {
    const dt = now - last;
    last = now;
    if (dt < 1000) {
      // > 1 s = tab ẩn / máy ngủ, không phải khung chậm
      second.push(dt);
      minute.push(dt);
    }
    if (now - secondStart >= 1000) {
      secondStart = now;
      const { tier, tierMode } = useRealism.getState();
      if (now - tierSince > WARMUP_MS && second.length > 0) p95s.push(percentile(second, 95));
      if (p95s.length > SLOW_SECONDS) p95s.shift();
      second = [];
      if (tierMode === 'auto') {
        const next = autoTier(tier, p95s);
        if (next !== tier) {
          setTier(next, true);
          p95s.length = 0;
        }
      }
    }
    if (now - minuteStart >= P95_EVERY_MS) {
      minuteStart = now;
      if (minute.length > 0) {
        const { backend, tier } = useRealism.getState();
        emitRealism({
          name: 'viewer.frame_p95',
          p50Ms: Math.round(percentile(minute, 50)),
          p95Ms: Math.round(percentile(minute, 95)),
          frameCount: minute.length,
          backend,
          tier,
        });
      }
      minute = [];
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
