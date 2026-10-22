/**
 * R2 (GĐ2): đứng yên thì ngừng vẽ. Vendor `post-processing.tsx` gọi `shouldDraw()` ở đầu
 * useFrame vẽ (priority 1 — chỗ vẽ duy nhất, R3F tự tắt render khi có subscriber priority>0).
 * Systems useFrame khác vẫn chạy (frame-limiter vẫn `advance`), chỉ bỏ lệnh vẽ.
 *
 * Bẩn (`markDirty`) → vẽ thêm HOLD_MS rồi SETTLE_FRAMES khung để TRAA/SSGI tích luỹ, rồi ngừng.
 */
import { useRealism } from './store';

export const HOLD_MS = 150;
/** ≈ 1 s ở 50 FPS (DECISIONS.md #2). */
export const SETTLE_FRAMES = 48;
/** Trần thời gian tích luỹ: GPU chậm (10 FPS) thì 48 khung kéo ~5 s — vẫn chỉ vẽ thêm ~1 s (DECISIONS #2). */
export const SETTLE_MAX_MS = 1000;

export interface IdleState {
  /** Vẽ tới mốc này (ms, `performance.now()`). */
  until: number;
  /** Khung tích luỹ còn lại sau `until`. */
  settle: number;
}

/** Hàm thuần duy nhất quyết định vẽ hay không; trả state mới (đã trừ khung tích luỹ nếu dùng). */
export function decide(s: IdleState, nowMs: number, enabled: boolean): { draw: boolean; next: IdleState } {
  if (!enabled || nowMs <= s.until) return { draw: true, next: s };
  if (s.settle > 0 && nowMs <= s.until + SETTLE_MAX_MS) return { draw: true, next: { until: s.until, settle: s.settle - 1 } };
  return { draw: false, next: s };
}

let state: IdleState = { until: 0, settle: SETTLE_FRAMES };
let lastReason = 'init';
let drawn = 0;
let skipped = 0;
/** Đếm lý do bẩn (chẩn đoán nguồn bẩn giả). */
const reasons: Record<string, number> = {};
/** 12 lần bẩn gần nhất `[ms, lý do]` — tìm nguồn bẩn lặp. */
const recent: [number, string][] = [];

/** Gọi từ mọi nguồn "động". `holdMs` dài hơn cho hiệu ứng lerp theo thời gian (đổi theme). */
export function markDirty(reason: string, holdMs = HOLD_MS, nowMs = performance.now()): void {
  state = { until: Math.max(state.until, nowMs + holdMs), settle: SETTLE_FRAMES };
  lastReason = reason;
  reasons[reason] = (reasons[reason] ?? 0) + 1;
  recent.push([Math.round(nowMs), reason]);
  if (recent.length > 12) recent.shift();
}

/** `?disable=idle` (cùng quy ước `?disable=` của vendor): tắt để bộ đo so trước/sau cùng tải GPU. */
const URL_OFF =
  typeof location !== 'undefined' && (new URLSearchParams(location.search).get('disable') ?? '').split(',').includes('idle');

export function shouldDraw(nowMs = performance.now()): boolean {
  const r = decide(state, nowMs, useRealism.getState().flags.idle && !URL_OFF);
  state = r.next;
  if (r.draw) drawn++;
  else skipped++;
  return r.draw;
}

/** Cho e2e/bộ đo (`window.__pascalIdle`). */
export function idleStats() {
  return { drawn, skipped, lastReason, reasons: { ...reasons }, recent: recent.slice(), now: Math.round(performance.now()), idle: useRealism.getState().flags.idle && !URL_OFF };
}

// --- Nguồn "động" kiểm mỗi tick (rẻ: so 32 số + độ dài mảng) --------------------------------

interface CameraLike {
  matrixWorld: { elements: ArrayLike<number> };
  projectionMatrix: { elements: ArrayLike<number> };
}
const camPrev = new Float64Array(32);
let selPrev: readonly unknown[] = [];
let sizePrev = '';

/**
 * Gọi đầu useFrame vẽ, TRƯỚC `shouldDraw`. Camera đổi / chọn đổi / có hover (viền nhấp nháy theo
 * `time`) / đổi cỡ → bẩn.
 */
export function pollDirty(
  camera: CameraLike,
  outliner: { selectedObjects: readonly unknown[]; hoveredObjects: readonly unknown[] },
  width: number,
  height: number,
  nowMs = performance.now(),
): void {
  const w = camera.matrixWorld.elements;
  const p = camera.projectionMatrix.elements;
  let moved = false;
  for (let i = 0; i < 16; i++) {
    if (camPrev[i] !== w[i]) { camPrev[i] = w[i]!; moved = true; }
    if (camPrev[16 + i] !== p[i]) { camPrev[16 + i] = p[i]!; moved = true; }
  }
  if (moved) markDirty('camera', HOLD_MS, nowMs);
  if (outliner.hoveredObjects.length > 0) markDirty('hover', HOLD_MS, nowMs);
  const sel = outliner.selectedObjects;
  if (sel.length !== selPrev.length || sel.some((o, i) => o !== selPrev[i])) {
    selPrev = sel.slice();
    markDirty('selection', HOLD_MS, nowMs);
  }
  const sz = `${width}x${height}`;
  if (sz !== sizePrev) { sizePrev = sz; markDirty('resize', HOLD_MS, nowMs); }
}

// --- Nguồn "động" theo sự kiện ---------------------------------------------------------------

/** Đổi theme nền lerp ~1 s (`Math.min(delta,.1)*4`) → giữ vẽ lâu hơn. */
export const THEME_HOLD_MS = 1500;

let installed = false;
/**
 * Nguồn toàn cục: loader xong (texture/GLB/HDRI), mọi thao tác chuột/phím/cuộn (gizmo kéo đổi
 * mesh trực tiếp không qua store), đổi tier/cờ realism. Gọi một lần (idempotent).
 */
export function installIdleSources(manager?: { onLoad?: () => void; onProgress?: (...a: never[]) => void }): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  if (manager) {
    const prevLoad = manager.onLoad;
    const prevProgress = manager.onProgress as ((...a: unknown[]) => void) | undefined;
    manager.onLoad = () => { markDirty('load', 500); prevLoad?.(); };
    (manager as { onProgress?: (...a: unknown[]) => void }).onProgress = (...a: unknown[]) => {
      markDirty('load', 500);
      prevProgress?.(...a);
    };
  }
  const input = () => markDirty('input');
  for (const ev of ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'keydown', 'keyup'] as const) {
    window.addEventListener(ev, input, { passive: true, capture: true });
  }
  window.addEventListener('resize', () => markDirty('resize'));
  // Tab quay lại: ảnh có thể đã bị trình duyệt bỏ.
  document.addEventListener('visibilitychange', () => markDirty('visibility'));
  useRealism.subscribe(() => markDirty('realism', THEME_HOLD_MS));
  (window as unknown as { __pascalIdle?: typeof idleStats }).__pascalIdle = idleStats;
}

/** Listener store zustand: bẩn khi khoá khác `ignore` đổi; lý do ghi tên khoá (chẩn đoán). */
export function storeDirty<S extends object>(name: string, holdMs = HOLD_MS, ignore: readonly string[] = []) {
  return (s: S, p: S) => {
    const keys = (Object.keys(s) as (keyof S & string)[]).filter((k) => s[k] !== p[k] && !ignore.includes(k));
    if (keys.length) markDirty(`${name}:${keys.slice(0, 3).join(',')}`, holdMs);
  };
}

/** Chỉ cho test. */
export function __resetIdle(): void {
  state = { until: 0, settle: SETTLE_FRAMES };
  drawn = skipped = 0;
  camPrev.fill(0);
  selPrev = [];
  sizePrev = '';
}
