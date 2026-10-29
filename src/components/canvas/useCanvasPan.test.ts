import type { PointerEvent as ReactPointerEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldStartPan, useCanvasPan } from './useCanvasPan';

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

describe('P6 — kéo gom theo khung hình', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextId: number;
  const runFrames = (): void => {
    const pending = [...frames.values()];
    frames.clear();
    act(() => pending.forEach((cb) => cb(0)));
  };

  beforeEach(() => {
    frames = new Map();
    nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.set(nextId, cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const surface = document.createElement('div');
  const ev = (clientX: number, clientY: number) =>
    ({
      button: 0,
      clientX,
      clientY,
      pointerId: 1,
      target: surface,
      currentTarget: surface,
      preventDefault: () => undefined,
    }) as unknown as ReactPointerEvent<HTMLElement>;

  function setup() {
    let renders = 0;
    const hook = renderHook(() => {
      renders += 1;
      return useCanvasPan();
    });
    act(() => hook.result.current.handlers.onPointerDown(ev(0, 0)));
    return { hook, renders: () => renders };
  }

  it('nhiều pointermove trong một khung: một khung chờ, một lượt dựng lại', () => {
    const { hook, renders } = setup();
    const before = renders();

    act(() => {
      for (let i = 1; i <= 10; i += 1) hook.result.current.handlers.onPointerMove(ev(i * 2, i));
    });

    expect(frames.size).toBe(1);
    expect(hook.result.current.offset).toEqual({ x: 0, y: 0 });
    expect(renders()).toBe(before);

    runFrames();

    expect(hook.result.current.offset).toEqual({ x: 20, y: 10 });
    expect(renders()).toBe(before + 1);
  });

  it('thả chuột ghi nốt phần dời còn treo và huỷ khung chờ', () => {
    const { hook } = setup();

    act(() => hook.result.current.handlers.onPointerMove(ev(5, 7)));
    act(() => hook.result.current.handlers.onPointerUp(ev(5, 7)));

    expect(frames.size).toBe(0);
    expect(hook.result.current.offset).toEqual({ x: 5, y: 7 });
    expect(hook.result.current.isPanning).toBe(false);
  });

  it('gỡ hook huỷ khung đang chờ', () => {
    const { hook } = setup();

    act(() => hook.result.current.handlers.onPointerMove(ev(3, 3)));
    expect(frames.size).toBe(1);
    hook.unmount();

    expect(frames.size).toBe(0);
  });
});

describe('panTo', () => {
  it('đặt thẳng độ dời; reset về 0', () => {
    const { result } = renderHook(() => useCanvasPan());
    act(() => result.current.panTo({ x: 40, y: -12 }));
    expect(result.current.offset).toEqual({ x: 40, y: -12 });
    expect(result.current.transform).toBe('translate(40px, -12px)');
    act(() => result.current.reset());
    expect(result.current.offset).toEqual({ x: 0, y: 0 });
  });
});
