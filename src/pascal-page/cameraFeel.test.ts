import { describe, expect, it } from 'vitest';

import { classifyWheel, pinchScale, wallsReadyToRejoin } from './cameraFeel';

const wheel = (deltaY: number, over: Partial<{ ctrlKey: boolean; deltaMode: number; deltaX: number }> = {}) => ({
  ctrlKey: false,
  deltaMode: 0,
  deltaX: 0,
  deltaY,
  ...over,
});
const LONG_AGO = Number.POSITIVE_INFINITY;

describe('classifyWheel', () => {
  it('nấc chuột Windows (±100, ±120) và chuột báo theo dòng là zoom', () => {
    expect(classifyWheel(wheel(120), LONG_AGO)).toBe('zoom');
    expect(classifyWheel(wheel(-100), LONG_AGO)).toBe('zoom');
    expect(classifyWheel(wheel(3, { deltaMode: 1 }), LONG_AGO)).toBe('zoom');
  });

  it('vuốt hai ngón là kéo khung: delta nhỏ, hoặc có deltaX', () => {
    expect(classifyWheel(wheel(12), LONG_AGO)).toBe('pan');
    expect(classifyWheel(wheel(-1.5), LONG_AGO)).toBe('pan');
    expect(classifyWheel(wheel(90, { deltaX: 4 }), LONG_AGO)).toBe('pan');
  });

  it('delta lớn giữa một lần vuốt vẫn là kéo khung, hết lần vuốt thì lại là nấc chuột', () => {
    expect(classifyWheel(wheel(140), 30)).toBe('pan');
    expect(classifyWheel(wheel(140), 400)).toBe('zoom');
  });

  it('ctrlKey (chụm hai ngón) thắng mọi dấu hiệu khác', () => {
    expect(classifyWheel(wheel(4, { ctrlKey: true }), 10)).toBe('pinch');
    expect(classifyWheel(wheel(120, { ctrlKey: true, deltaMode: 1 }), LONG_AGO)).toBe('pinch');
  });
});

describe('pinchScale', () => {
  it('chụm ra (deltaY âm) tới gần, 1:1 với tỉ lệ tay', () => {
    expect(pinchScale(0)).toBe(1);
    expect(pinchScale(-10)).toBeCloseTo(1 / pinchScale(10));
    expect(pinchScale(-10)).toBeCloseTo(Math.exp(-0.1));
  });

  it('Ctrl + bánh xe thật không nhảy quá một nấc', () => {
    expect(pinchScale(120)).toBeCloseTo(Math.exp(0.25));
    expect(pinchScale(-120)).toBeCloseTo(Math.exp(-0.25));
  });
});

describe('wallsReadyToRejoin', () => {
  const released = ['a', 'b'];

  it('chỉ tường đã hết sáng', () => {
    expect(wallsReadyToRejoin(released, new Set(['a']), false, 200, 180)).toEqual(['b']);
  });

  it('camera đang chạy hoặc chưa im đủ lâu thì chưa gộp', () => {
    expect(wallsReadyToRejoin(released, new Set(), true, 200, 180)).toEqual([]);
    expect(wallsReadyToRejoin(released, new Set(), false, 100, 180)).toEqual([]);
  });
});
