/**
 * AppFront (giật thanh nổi, 04/11): giữ thanh nổi trong cửa sổ NGAY TRONG KHUNG camera đổi.
 *
 * `useClampActionBars` (canvas-help.tsx) chỉnh `translate` của thanh theo nhịp 200 ms. Giữa hai nhịp thanh đi
 * theo camera với độ lệch cũ, tới nhịp thì giật về: nhảy 270–285 px khi vách đang ở gần (đỉnh vách ngoài khung).
 * Ở đây tính bằng phép chiếu, không đọc `getBoundingClientRect` mỗi khung (đọc mỗi khung từng làm chậm xoay/zoom,
 * UX-01); nhịp 200 ms vẫn chạy, thấy đúng số thì không ghi gì.
 */
import { clampShift } from './clamp-shift';

/** Cùng bộ chọn với `ACTION_BARS` trong canvas-help.tsx. */
export const ACTION_BAR_SELECTOR = [
  'div.pointer-events-auto.flex.items-center.gap-1.rounded-lg.border.p-1.shadow-xl',
  'div.pointer-events-auto.mt-1.inline-flex.w-max.rounded-lg.border.shadow-md',
].join(',');

/** Nhịp 200 ms làm tròn khác phép chiếu tối đa ~1 px: lệch dưới mức này thì để yên, tránh hai bên ghi đè nhau. */
const TOLERANCE_PX = 2;
/** Số khung giữa hai lần đo lại cỡ thanh (cỡ gần như không đổi, đo mỗi khung là thừa). */
const REMEASURE_FRAMES = 30;

export interface BarBox {
  /** Vị trí và cỡ trong khối bọc, px riêng chưa nhân tỉ lệ. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Độ dời (px riêng của thanh) đưa thanh vào trong cửa sổ. `cx`, `cy` = tâm khối bọc trên cửa sổ. */
export function barShift(
  box: BarBox,
  root: { width: number; height: number },
  cx: number,
  cy: number,
  scale: number,
  winW: number,
  winH: number,
): { x: number; y: number } {
  const left = cx + (box.left - root.width / 2) * scale;
  const top = cy + (box.top - root.height / 2) * scale;
  const { dx, dy } = clampShift(
    { left, right: left + box.width * scale, top, bottom: top + box.height * scale },
    winW,
    winH,
  );
  return { x: Math.round(dx / scale), y: Math.round(dy / scale) };
}

/** Dời có cần ghi không: về 0 thì ghi ngay, còn lại bỏ qua lệch nhỏ. */
export function needsWrite(prevX: number, prevY: number, x: number, y: number): boolean {
  if (x === prevX && y === prevY) return false;
  if (x === 0 && y === 0) return true;
  return Math.abs(x - prevX) >= TOLERANCE_PX || Math.abs(y - prevY) >= TOLERANCE_PX;
}

export interface BarCache {
  root: HTMLElement | null;
  bars: { el: HTMLElement; box: BarBox }[];
  rootSize: { width: number; height: number };
  age: number;
}

export const newBarCache = (): BarCache => ({ root: null, bars: [], rootSize: { width: 0, height: 0 }, age: 0 });

/** Gọi mỗi khung từ `floating-action-menu.tsx`, sau khi drei <Html> đã đặt vị trí. */
export function clampBarsInFrame(root: HTMLElement, cx: number, cy: number, scale: number, cache: BarCache): void {
  if (cache.root !== root || cache.age++ % REMEASURE_FRAMES === 0) {
    cache.root = root;
    cache.rootSize = { width: root.offsetWidth, height: root.offsetHeight };
    cache.bars = [...root.querySelectorAll<HTMLElement>(ACTION_BAR_SELECTOR)].map((el) => ({
      el,
      box: { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight },
    }));
  }
  if (!cache.rootSize.width) return;
  for (const { el, box } of cache.bars) {
    const { x, y } = barShift(box, cache.rootSize, cx, cy, scale, window.innerWidth, window.innerHeight);
    const prevX = Number(el.dataset.clampX ?? 0);
    const prevY = Number(el.dataset.clampY ?? 0);
    if (!needsWrite(prevX, prevY, x, y)) continue;
    el.dataset.clampX = String(x);
    el.dataset.clampY = String(y);
    el.style.translate = x || y ? `${x}px ${y}px` : '';
  }
}
