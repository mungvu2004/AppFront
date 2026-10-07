import { useCallback, useEffect, useState } from 'react';

/** Một giây, đặt tên để `local/no-raw-duration` thấy hằng số chứ không phải con số. */
const COUNTDOWN_TICK_MS = 1000;

/**
 * Đếm ngược khoá nút sau một 429. Số giây chỉ để khoá, không bao giờ in ra.
 *
 * @example
 * const { isLocked, lock } = useLockout();
 */
export function useLockout(): { readonly isLocked: boolean; readonly lock: (seconds: number) => void } {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsLeft((remaining) => (remaining > 0 ? remaining - 1 : 0));
    }, COUNTDOWN_TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [secondsLeft]);

  const lock = useCallback((seconds: number) => {
    setSecondsLeft(seconds);
  }, []);

  return { isLocked: secondsLeft > 0, lock };
}
