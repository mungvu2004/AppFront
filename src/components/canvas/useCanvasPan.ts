import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Kéo bản vẽ dùng chung cho mọi canvas (G4a-19, G4b-08).
 *
 * Kéo được khi: chuột giữa ở bất kỳ đâu; giữ Space + chuột trái; chuột trái trên NỀN
 * (đích CHÍNH LÀ phần tử có `data-canvas-bg`, hoặc chính phần tử gắn `onPointerDown`; con của
 * nền như tường/chuỗi không kéo — kéo sẽ giữ con trỏ và nuốt `click` chọn hình).
 * Lăn chuột gọi `onWheelZoom(+1 | -1)` (lăn lên = phóng to) và chặn cuộn trang.
 *
 * Cách gắn: `<div ref={pan.ref} {...pan.handlers}>` bao vùng vẽ; lớp nội dung nhận
 * `style={{ transform: pan.transform }}` (đặt TRƯỚC `scale()` của màn). `pan.reset()`
 * khi bấm "Vừa khung nhìn".
 *
 * Độ dời gom theo `requestAnimationFrame` (P6): mỗi `pointermove` chỉ cộng vào ref, tối đa một
 * `setOffset` mỗi khung — trước đây mỗi sự kiện dựng lại cả canvas (~8 ms/lần). Thả chuột thì
 * ghi nốt phần còn treo. Không ghi thẳng DOM: `WallLayerCanvas` đọc `offset` ngay trong lúc kéo.
 */
export interface CanvasPanState {
  ref: (el: HTMLElement | null) => void;
  offset: { x: number; y: number };
  transform: string;
  isPanning: boolean;
  /** Đang giữ Space: màn nên đổi con trỏ thành `grab`. */
  spaceHeld: boolean;
  reset: () => void;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
    /** Trình duyệt tự thu hồi capture (cảm ứng bị cuộn trang cướp, cửa sổ mất focus): xoá trạng thái kéo. */
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
  };
  /** Gắn vào mặt kéo: `touch-none` để ngón tay kéo bản vẽ thay vì cuộn/phóng trang. */
  surfaceClassName: string;
}

/** Quyết định một lần nhấn chuột có bắt đầu kéo không (tách riêng để test). */
export function shouldStartPan(
  button: number,
  spaceHeld: boolean,
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): boolean {
  if (button === 1) return true;
  if (button !== 0) return false;
  if (spaceHeld) return true;
  if (target === currentTarget) return true;
  return target instanceof Element && target.hasAttribute('data-canvas-bg');
}

export function useCanvasPan(onWheelZoom?: (direction: 1 | -1) => void): CanvasPanState {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const wheelRef = useRef(onWheelZoom);
  wheelRef.current = onWheelZoom;
  const pendingDelta = useRef({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  /** Đẩy phần dời đang gom vào state (một lượt dựng lại) và huỷ khung đang chờ. */
  const commitDelta = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const { x: dx, y: dy } = pendingDelta.current;
    if (dx === 0 && dy === 0) return;
    pendingDelta.current = { x: 0, y: 0 };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        setSpaceHeld(true);
        if (el?.matches(':hover')) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    // Alt+Tab khi đang giữ Space thì lỡ `keyup`: mất focus cửa sổ coi như thả Space.
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [el]);

  // React gắn `wheel` dạng passive nên không chặn được cuộn trang: gắn tay.
  useEffect(() => {
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelRef.current || e.deltaY === 0) return;
      e.preventDefault();
      wheelRef.current(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [el]);

  const end = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!last.current) return;
    last.current = null;
    commitDelta();
    setIsPanning(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }, [commitDelta]);

  return {
    ref: setEl,
    offset,
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    isPanning,
    spaceHeld,
    reset: useCallback(() => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      pendingDelta.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    }, []),
    handlers: {
      onPointerDown: (e) => {
        if (!shouldStartPan(e.button, spaceHeld, e.target, e.currentTarget)) return;
        e.preventDefault();
        last.current = { x: e.clientX, y: e.clientY };
        setIsPanning(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        const p = last.current;
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        last.current = { x: e.clientX, y: e.clientY };
        const acc = pendingDelta.current;
        pendingDelta.current = { x: acc.x + dx, y: acc.y + dy };
        frame.current ??= requestAnimationFrame(() => {
          frame.current = null;
          commitDelta();
        });
      },
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
    },
    surfaceClassName: 'touch-none',
  };
}
