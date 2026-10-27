/**
 * Toạ độ con trỏ trên canvas, gom theo khung hình (PERF-03 P5).
 *
 * Trình duyệt bắn `mousemove` nhiều hơn số khung vẽ được; mỗi lần đặt state là một lượt
 * render cả màn. Ở đây chỉ giữ giá trị MỚI NHẤT và đặt state tối đa một lần mỗi
 * `requestAnimationFrame`. Môi trường không có rAF thì đặt thẳng như trước.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { WallLayerPointerReading } from './wallLayerHatch';

/** Trả `[reading, onPointerMove]`: `onPointerMove` ổn định, cập nhật `reading` ≤ 1 lần/khung. */
export function useFramePointerReading() {
  const [reading, setReading] = useState<WallLayerPointerReading | null>(null);
  const pendingRef = useRef<WallLayerPointerReading | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const onPointerMove = useCallback((next: WallLayerPointerReading | null) => {
    if (typeof requestAnimationFrame !== 'function') {
      setReading(next);

      return;
    }

    pendingRef.current = next;

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setReading(pendingRef.current);
      });
    }
  }, []);

  return [reading, onPointerMove] as const;
}
