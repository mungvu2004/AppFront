import { useEffect, useState, type RefObject } from 'react';

/** Bóng mép phía còn cột để cuộn tới: thanh cuộn overlay (di động) ẩn nên bảng rộng trông như bị cắt. */
const EDGE_SHADOW = { left: 'inset 12px 0 8px -8px var(--shadow-color-float)', right: 'inset -12px 0 8px -8px var(--shadow-color-float)' };

/** `box-shadow` (inline, không tốn CSS) cho hộp cuộn ngang; `undefined` khi không còn gì để cuộn tới. */
export function useScrollEdgeShadow(ref: RefObject<HTMLDivElement | null>) {
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const update = () => {
      const left = el.scrollLeft > 0;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [ref]);

  const shadows = [edges.left && EDGE_SHADOW.left, edges.right && EDGE_SHADOW.right].filter(Boolean);
  return shadows.length === 0 ? undefined : shadows.join(', ');
}
