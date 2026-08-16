import { useState, useEffect, useRef } from 'react';

import { MOTION_DURATIONS_MS, MOTION_EASINGS } from '@/lib/motion';

/**
 * The shared decelerating curve, not a private one.
 *
 * This used to be a local `easeOutQuart` — a fourth curve in a repository that
 * allows three. It was more aggressive than `enter` (0.94 against 0.84 at the
 * halfway point), so a counter now settles a shade more gently. That is the
 * intended cost of having one motion vocabulary instead of four.
 */
const easeEnter = MOTION_EASINGS.enter.at;

export function useNumberTween(
  targetValue: number | undefined,
  durationMs: number = MOTION_DURATIONS_MS.standard,
) {
  const [displayValue, setDisplayValue] = useState<number | undefined>(targetValue);
  const startTime = useRef<number | null>(null);
  const startValue = useRef<number | undefined>(targetValue);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // If targetValue goes undefined, immediately clear
    if (targetValue === undefined) {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      setDisplayValue(undefined);
      startValue.current = undefined;
      return;
    }

    // First time mounting with a value, don't tween
    if (startValue.current === undefined) {
      setDisplayValue(targetValue);
      startValue.current = targetValue;
      return;
    }

    if (startValue.current === targetValue) {
      return;
    }

    // Start tween
    startValue.current = displayValue ?? 0;
    startTime.current = performance.now();
    
    if (rafId.current) cancelAnimationFrame(rafId.current);

    const animate = (time: number) => {
      const elapsed = time - startTime.current!;
      const progress = Math.min(elapsed / durationMs, 1);
      
      const currentStart = startValue.current ?? 0;
      const eased = easeEnter(progress);
      
      const currentDisplay = currentStart + (targetValue - currentStart) * eased;
      
      setDisplayValue(progress === 1 ? targetValue : currentDisplay);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        startValue.current = targetValue;
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [targetValue, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return displayValue;
}
