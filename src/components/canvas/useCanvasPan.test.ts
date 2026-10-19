import { describe, expect, it } from 'vitest';
import { shouldStartPan } from './useCanvasPan';

describe('shouldStartPan', () => {
  const bg = document.createElement('div');
  bg.setAttribute('data-canvas-bg', '');
  const wall = document.createElement('div');
  const root = document.createElement('div');

  it('chuột giữa luôn kéo', () => expect(shouldStartPan(1, false, wall, root)).toBe(true));
  it('Space + chuột trái kéo cả trên hình', () => expect(shouldStartPan(0, true, wall, root)).toBe(true));
  it('chuột trái trên nền thì kéo', () => {
    expect(shouldStartPan(0, false, bg, root)).toBe(true);
    expect(shouldStartPan(0, false, root, root)).toBe(true);
  });
  it('chuột trái trên hình (không Space) để dành cho chọn', () =>
    expect(shouldStartPan(0, false, wall, root)).toBe(false));
  it('chuột trái trên hình nằm TRONG nền không kéo (giữ click chọn)', () => {
    const shape = document.createElement('div');
    bg.appendChild(shape);
    expect(shouldStartPan(0, false, shape, root)).toBe(false);
  });
  it('chuột phải không kéo', () => expect(shouldStartPan(2, true, bg, root)).toBe(false));
});
