import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { barShift, clampBarsAtAnchor, needsWrite, newBarCache } from './clamp-bar';

const box = { left: 0, top: 0, width: 174, height: 38 };
const root = { width: 174, height: 38 };

describe('barShift', () => {
  it('không dời khi thanh nằm trong cửa sổ', () => {
    expect(barShift(box, root, 500, 300, 1, 1100, 620)).toEqual({ x: 0, y: 0 });
  });

  it('đỉnh vách ngoài khung: dời đúng tới mép trên chừa thanh công cụ (64 px)', () => {
    // Tâm ở y = -391: mép trên -410, phải xuống 474 px.
    expect(barShift(box, root, 576, -391, 1, 1100, 620)).toEqual({ x: 0, y: 474 });
  });

  it('camera đi tiếp thì độ dời đi theo đúng khung đó, thanh đứng yên tại mép', () => {
    const y = (cy: number) => cy - 19 + barShift(box, root, 576, cy, 1, 1100, 620).y;
    expect(y(-391)).toBe(64);
    expect(y(-606)).toBe(64);
    expect(y(-1367)).toBe(64);
  });

  it('đổi px màn hình về px riêng của thanh theo tỉ lệ', () => {
    // Tỉ lệ 0,5: mép trên = -100 - 9,5 = -109,5, cần 173,5 px màn hình = 347 px riêng.
    expect(barShift(box, root, 576, -100, 0.5, 1100, 620).y).toBe(347);
  });

  it('thanh phụ dưới thanh chính tính theo vị trí riêng trong khối bọc', () => {
    const tall = { width: 174, height: 80 };
    const lower = { left: 20, top: 42, width: 134, height: 38 };
    expect(barShift(lower, tall, 576, 590, 1, 1100, 620).y).toBe(-82);
  });
});

describe('needsWrite', () => {
  it('giữ nguyên khi không đổi hoặc chỉ lệch làm tròn của nhịp 200 ms', () => {
    expect(needsWrite(0, 474, 0, 474)).toBe(false);
    expect(needsWrite(0, 474, 0, 475)).toBe(false);
  });

  it('ghi khi lệch thật và khi về 0', () => {
    expect(needsWrite(0, 474, 0, 480)).toBe(true);
    expect(needsWrite(0, 1, 0, 0)).toBe(true);
  });
});

describe('clampBarsAtAnchor', () => {
  // Đúng class của NodeActionMenu, thanh dùng chung cho một vật và nhiều vật.
  const BAR_CLASS = 'pointer-events-auto flex items-center gap-1 rounded-lg border p-1 shadow-xl';
  const size = { width: 1100, height: 620, left: 0, top: 0 };
  const sized = (el: HTMLElement, w: number, h: number) => {
    Object.defineProperty(el, 'offsetWidth', { value: w });
    Object.defineProperty(el, 'offsetHeight', { value: h });
    return el;
  };
  const setup = () => {
    const root = sized(document.createElement('div'), 174, 38);
    const bar = sized(document.createElement('div'), 174, 38);
    bar.className = BAR_CLASS;
    root.append(bar);
    const camera = new PerspectiveCamera(50, 1100 / 620, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld();
    return { root, bar, camera };
  };
  const frame = (root: HTMLElement, anchor: Vector3, camera: PerspectiveCamera) =>
    clampBarsAtAnchor(root, anchor, { camera, size }, 1, newBarCache());

  it('điểm neo ngoài mép trên: dời ngay trong khung đó, không chờ nhịp 200 ms', () => {
    const { root, bar, camera } = setup();
    frame(root, new Vector3(0, 8, 0), camera);
    expect(Number(bar.dataset.clampY)).toBeGreaterThan(0);
    expect(bar.style.translate).toBe(`0px ${bar.dataset.clampY}px`);
  });

  it('điểm neo về giữa khung: gỡ độ dời cũ', () => {
    const { root, bar, camera } = setup();
    frame(root, new Vector3(0, 8, 0), camera);
    frame(root, new Vector3(0, 0, 0), camera);
    expect(bar.dataset.clampY).toBe('0');
    expect(bar.style.translate).toBe('');
  });

  it('điểm neo sau lưng camera: không ghi gì', () => {
    const { root, bar, camera } = setup();
    frame(root, new Vector3(0, 8, 20), camera);
    expect(bar.dataset.clampY).toBeUndefined();
    expect(bar.style.translate).toBe('');
  });
});
