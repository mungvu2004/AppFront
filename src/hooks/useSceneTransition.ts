import { useEffect, useRef, useState } from 'react';

import {
  createSceneOrchestrator,
  defaultFrameScheduler,
  type FrameScheduler,
  type MotionConditions,
  type MotionPerformanceSignal,
  type SceneFrame,
  type SceneOrchestrator,
  type SceneTransitionKind,
} from '@/lib/motion';

import { useMotionConditions } from './useMotionConditions';

export interface UseSceneTransitionOptions {
  /** Which kind of handover this is; decides the timing. */
  readonly kind: SceneTransitionKind;
  /** R-04's latest reading, where there is a 3D scene being measured. */
  readonly performanceSignal?: MotionPerformanceSignal | null;
  /** Overrides the resolved conditions outright. For stories and tests. */
  readonly conditions?: MotionConditions;
  /** Test seam for the clock and the frame queue. Must be referentially stable. */
  readonly scheduler?: FrameScheduler;
}

export interface SceneTransitionState extends SceneFrame {
  /**
   * The scene on its way out, or `null` before the first handover.
   *
   * It keeps the last handover's source after `done` — a caller stops drawing
   * the outgoing layer because `done` is true, not because this went null.
   */
  readonly from: string | null;
  /** The scene arriving, or simply the one on screen when nothing is moving. */
  readonly to: string;
  readonly isRunning: boolean;
}

/**
 * Hand the screen over from one scene to the next when `to` changes.
 *
 * The React half of `orchestrate.ts`. A component passes whatever identifies the
 * scene — `viewMode`, a floor id, a route — and gets back the two progress
 * values needed to draw both layers during the overlap:
 *
 * ```ts
 * const scene = useSceneTransition(viewMode, { kind: 'view' });
 * // draw the `scene.from` layer at opacity 1 - scene.exit, while !scene.done
 * // draw the `scene.to`   layer at opacity scene.enter
 * ```
 *
 * **The first value is not a handover.** There is nothing to hand over from on
 * the first render, so the scene is simply present and `done` is true. Animating
 * it would mean every screen faded in on load, which is a page transition
 * nobody asked for.
 *
 * **Changing `to` mid-flight supersedes.** The orchestrator guarantees one
 * handover at a time by replacing, never by queueing, so a reader paging through
 * floors is never made to wait for an animation — see `orchestrate.ts`.
 *
 * **Reduced motion and a struggling machine are handled for you** through
 * {@link useMotionConditions}: the handover collapses to nothing, or to the
 * instant slot, without the caller branching.
 */
export function useSceneTransition(
  to: string,
  options: UseSceneTransitionOptions,
): SceneTransitionState {
  const resolved = useMotionConditions(options.performanceSignal);
  const conditions = options.conditions ?? resolved;
  const { kind } = options;

  // Latest-ref rather than dependencies: these are read at the moment a handover
  // begins, and a change to either mid-flight must not restart what is running.
  const conditionsRef = useRef<MotionConditions>(conditions);
  conditionsRef.current = conditions;

  const schedulerRef = useRef<FrameScheduler>(options.scheduler ?? defaultFrameScheduler);
  schedulerRef.current = options.scheduler ?? defaultFrameScheduler;

  const orchestratorRef = useRef<SceneOrchestrator | null>(null);
  if (orchestratorRef.current === null) {
    orchestratorRef.current = createSceneOrchestrator();
  }

  /** The destination of the last handover started, so a re-run can tell if it is new. */
  const lastToRef = useRef<string | null>(null);
  const fromRef = useRef<string | null>(null);

  const [frame, setFrame] = useState<SceneFrame>(() => ({
    phase: 'idle',
    exit: 0,
    enter: 1,
    done: true,
  }));

  useEffect(() => {
    const orchestrator = orchestratorRef.current;

    if (orchestrator === null) {
      return undefined;
    }

    // Beginning and driving are separated on purpose: this effect can re-run
    // while a handover is already in flight — `kind` changing, or a StrictMode
    // remount — and its cleanup will have cancelled the frame loop on the way
    // out. Starting a *new* handover would be wrong, since the destination has
    // not changed; doing nothing would leave the old one frozen where it stood.
    // So beginning is conditional on `to` and driving is unconditional.
    if (lastToRef.current !== to) {
      const previous = lastToRef.current;
      lastToRef.current = to;

      if (previous !== null) {
        fromRef.current = previous;
        orchestrator.begin({ kind, from: previous, to, ...conditionsRef.current });
      }
    }

    setFrame(orchestrator.sample());

    if (!orchestrator.isRunning) {
      return undefined;
    }

    const scheduler = schedulerRef.current;
    let lastTimeMs = scheduler.now();
    let handle = 0;
    let cancelled = false;

    const step = (timeMs: number): void => {
      if (cancelled) {
        return;
      }

      const deltaMs = Math.max(0, timeMs - lastTimeMs);
      lastTimeMs = timeMs;

      const next = orchestrator.advance(deltaMs);
      setFrame(next);

      if (!next.done) {
        handle = scheduler.request(step);
      }
    };

    handle = scheduler.request(step);

    return () => {
      cancelled = true;
      scheduler.cancel(handle);
    };
  }, [kind, to]);

  return {
    ...frame,
    from: fromRef.current,
    to,
    isRunning: !frame.done,
  };
}
