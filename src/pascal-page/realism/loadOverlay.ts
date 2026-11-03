/**
 * Nhãn lần nạp đầu của khung 3D: viên nhỏ "Đang chuẩn bị nội thất… n/m" giữa đáy, trên thanh dock — KHÔNG
 * che cảnh (che cả khung thì căn nhà ẩn tới 12–34 s, bản cũ hiện tường ~4 s). `warm.ts` gắn nhãn lên khung
 * chứa canvas khi bọc renderer mới; trong lúc nạp đầu kết cấu dựng/vẽ trước, đồ đạc hiện dần. Gỡ khi hết việc
 * (không pipeline/bản dựng/tải tệp nào còn chờ, yên `LOAD_QUIET_MS`) hoặc tới mốc `deadline` (= lúc nạp bắt
 * đầu + `LOAD_CAP_MS`, do `warm.ts` giữ). `?disable=loadoverlay` tắt.
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

/**
 * Kiểu viên nhãn: nhỏ, không chặn chuột, trên nhãn phòng HTML (drei `Html` dùng z-index tới 16777271).
 * Trang 3D không nạp `globals.css` → màu lấy từ token `--pa-*` của `pascal-theme.css` (đặt trên `body`, đủ hai chủ đề).
 */
export const PILL_STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  left: '50%',
  bottom: '96px',
  transform: 'translateX(-50%)',
  zIndex: '16777272',
  padding: '6px 14px',
  borderRadius: '999px',
  background: 'var(--pa-surface)',
  boxShadow: 'var(--pa-shadow-float)',
  color: 'var(--pa-text-3)',
  font: '500 13px/1.4 system-ui, sans-serif',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

export function installLoadOverlay(host: HTMLElement, stats: () => LoadStats, onDone: () => void, deadline = performance.now() + LOAD_CAP_MS): void {
  hookLoads();
  const t0 = deadline - LOAD_CAP_MS;
  const b = stats();
  const l0 = { ...loads };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.dataset.testid = 'pascal-load-overlay';
  Object.assign(el.style, PILL_STYLE, { transition: `opacity ${cssDurationMs('fast', { reducedMotion })} ease` });
  el.textContent = 'Đang chuẩn bị nội thất…';
  host.appendChild(el);
  let finished = false;
  const finish = (ended = true) => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    clearTimeout(cap);
    if (ended) onDone();
    el.style.opacity = '0';
    setTimeout(() => el.remove(), durationMs('fast', { reducedMotion }));
  };
  const timer = setInterval(() => {
    if (!el.isConnected) return finish(false); // renderer gỡ giữa chừng: renderer mới (nếu có) giữ mốc nạp đầu, không kết thúc hộ
    const s = stats();
    const now = performance.now();
    const done = s.buildsDone - b.buildsDone + (s.done - b.done) + (loads.done - l0.done);
    const total = s.builds - b.builds + (s.started - b.started) + (loads.started - l0.started) + (s.texWaiting ?? 0);
    if (total > 0) el.textContent = `Đang chuẩn bị nội thất… ${done}/${total}`;
    if (loadDone(s, b.builds, loads.started - loads.done, loads.lastEndAt, t0, now)) finish();
  }, POLL_MS);
  // Mốc cứng riêng: vòng hỏi 100 ms có thể bị kẹp (tab nền) — tới mốc là gỡ.
  const cap = setTimeout(() => finish(), Math.max(0, deadline - performance.now()));
}
