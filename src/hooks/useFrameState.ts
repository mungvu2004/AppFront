/**
 * State gom theo khung hình (PERF-03 P5).
 *
 * Trình duyệt bắn `pointermove` nhiều hơn số khung vẽ được; mỗi lần đặt state là một lượt
 * render cả màn. Ở đây chỉ giữ giá trị MỚI NHẤT và đặt state tối đa một lần mỗi
 * `requestAnimationFrame`. Môi trường không có rAF thì đặt thẳng như trước.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Trả `[value, setFramed]`: `setFramed` ổn định, cập nhật `value` ≤ 1 lần/khung. */
export function useFrameState<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const pendingRef = useRef<T>(initial);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const setFramed = useCallback((next: T) => {
    if (typeof requestAnimationFrame !== 'function') {
      setValue(next);

      return;
    }

    pendingRef.current = next;

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        setValue(pendingRef.current);
      });
    }
  }, []);

  return [value, setFramed] as const;
}
