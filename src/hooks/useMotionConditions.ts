import { useMemo } from 'react';

import { isLowPerformance, type MotionConditions, type MotionPerformanceSignal } from '@/lib/motion';

import { useReducedMotion } from './useReducedMotion';

/**
 * The two reasons movement gets cut back, resolved into one value.
 *
 * One is a preference the reader stated to their operating system; the other is
 * a measurement R-04 took of the machine. Every animated thing needs both and
 * neither belongs in a component, so they are gathered once here and passed down
 * as {@link MotionConditions} — the shape `planScene`, `conditionedDurationMs`
 * and `staggerDelayMs` all already accept.
 *
 * @param signal R-04's latest reading — a `PerfSample` from `PerfMonitor.onSample`,
 * or the monitor itself. Omit it where there is no 3D scene to measure; a list
 * of rooms has no frame rate of its own and should not pretend to.
 *
 * The returned object is stable while nothing changes, so it is safe to put
 * straight into a dependency list.
 */
export function useMotionConditions(
  signal?: MotionPerformanceSignal | null,
): MotionConditions {
  const reducedMotion = useReducedMotion();
  const lowPerformance = isLowPerformance(signal);

  return useMemo(() => ({ reducedMotion, lowPerformance }), [reducedMotion, lowPerformance]);
}
