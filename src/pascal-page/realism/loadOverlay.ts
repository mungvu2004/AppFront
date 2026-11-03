/**
 * Lớp che lần nạp đầu của khung 3D: "Đang chuẩn bị mô hình 3D… n/m" thay cho cảnh hiện dần từng vật
 * (W1/W2 dựng shader bất đồng bộ). `warm.ts` gắn lớp này lên khung chứa canvas khi bọc renderer mới và,
 * trong lúc che, dựng hết shader trong vài khung + chỉ vẽ ~5 khung/s. Gỡ khi hết việc (không pipeline/bản
 * dựng/tải tệp nào còn chờ, yên `LOAD_QUIET_MS`) hoặc sau `LOAD_CAP_MS`. `?disable=loadoverlay` tắt.
 *
 * DOM thuần (không React): mount từ đúng chỗ renderer ra đời, không cần sửa cây component của vendor.
 */
import { DefaultLoadingManager } from 'three';

import { cssDurationMs, durationMs } from '../../lib/motion/tokens';

export const LOAD_CAP_MS = 20_000;
export const LOAD_QUIET_MS = 500;
const POLL_MS = 100;

export interface LoadStats {
  builds: number;
  buildsDone: number;
  started: number;
  done: number;
  lastActivityAt: number;
  /** Vật liệu đang đợi ảnh (chưa dựng) — tính là việc còn chờ. */
  texWaiting?: number;
}

/** Tải tệp qua `DefaultLoadingManager` (GLB, ảnh vật liệu, HDRI): một vật tới muộn = thêm bản dựng. */
const loads = { started: 0, done: 0, lastEndAt: -Infinity };
let loadsHooked = false;
function hookLoads(): void {
  if (loadsHooked) return;
  loadsHooked = true;
  const m = DefaultLoadingManager as unknown as { itemStart(url: string): void; itemEnd(url: string): void };
  const start = m.itemStart.bind(m);
  const end = m.itemEnd.bind(m);
  m.itemStart = (url) => {
    loads.started++;
    start(url);
  };
  // three gọi `itemEnd` cả khi lỗi (sau `itemError`).
  m.itemEnd = (url) => {
    loads.done++;
    loads.lastEndAt = performance.now();
    end(url);
  };
}

/** Gỡ lớp che chưa? Hàm thuần — `base` = số bản dựng lúc lớp che mở (bộ đếm `warm.ts` là toàn cục). */
export function loadDone(s: LoadStats, baseBuilds: number, loadsInFlight: number, lastLoadEndAt: number, startedAt: number, nowMs: number): boolean {
  if (nowMs - startedAt >= LOAD_CAP_MS) return true;
  if (s.started > s.done || s.builds > s.buildsDone || (s.texWaiting ?? 0) > 0 || loadsInFlight > 0) return false;
  // ponytail: "xong" = có bản dựng mới rồi yên 500 ms; dự án tải chậm hơn thế trước bản dựng đầu (lưới/nền
  // đã dựng) thì gỡ sớm, cảnh hiện dần như trước. Cần chắc hơn thì đợi cờ "đã nạp dự án" của editor.
  return s.builds > baseBuilds && nowMs - Math.max(s.lastActivityAt, lastLoadEndAt) >= LOAD_QUIET_MS;
}

export function installLoadOverlay(host: HTMLElement, stats: () => LoadStats, onDone: () => void): void {
  hookLoads();
  const t0 = performance.now();
  const b = stats();
  const l0 = { ...loads };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.dataset.testid = 'pascal-load-overlay';
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-app, #f4f2ee)',
    color: 'var(--text-muted, #5f5f5f)',
    font: '500 14px/1.4 system-ui, sans-serif',
    // Không chặn chuột: lớp che chỉ giấu cảnh đang dựng dở; e2e/người dùng thao tác canvas vẫn tới.
    pointerEvents: 'none',
    transition: `opacity ${cssDurationMs('fast', { reducedMotion })} ease`,
  });
  el.textContent = 'Đang chuẩn bị mô hình 3D…';
  host.appendChild(el);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    onDone();
    el.style.opacity = '0';
    setTimeout(() => el.remove(), durationMs('fast', { reducedMotion }));
  };
  const timer = setInterval(() => {
    if (!el.isConnected) return finish(); // renderer gỡ (rời editor) giữa chừng
    const s = stats();
    const now = performance.now();
    const done = s.buildsDone - b.buildsDone + (s.done - b.done) + (loads.done - l0.done);
    const total = s.builds - b.builds + (s.started - b.started) + (loads.started - l0.started) + (s.texWaiting ?? 0);
    if (total > 0) el.textContent = `Đang chuẩn bị mô hình 3D… ${done}/${total}`;
    if (loadDone(s, b.builds, loads.started - loads.done, loads.lastEndAt, t0, now)) finish();
  }, POLL_MS);
}
