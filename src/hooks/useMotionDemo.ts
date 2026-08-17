import { useCallback, useMemo, useState } from 'react';

import {
  conditionedDurationMs,
  planScene,
  staggerSchedule,
  type MotionConditions,
  type MotionPerformanceSignal,
  type ScenePhase,
  type SceneTransitionKind,
} from '@/lib/motion';

import { useMotionConditions } from './useMotionConditions';
import { useSceneTransition } from './useSceneTransition';

/**
 * The state behind the motion demo screen.
 *
 * All of it, including the arithmetic — the screen it serves does nothing but
 * place the numbers this returns. Which is also why the numbers come back as
 * numbers: `opacity` and `shiftPx` rather than a style object or a class name,
 * so this file needs to know nothing about Tailwind or about tokens.
 */

/** The two scenes the demo hands back and forth between. */
export type MotionDemoScene = 'plan' | 'model';

/** A frame rate low enough to trip R-04's floor, for the simulation switch. */
const STRUGGLING_FRAME_RATE = 12;

/** A comfortable frame rate, for when the switch is off. */
const HEALTHY_FRAME_RATE = 60;

/** How far a scene slides as it hands over. A transform, so no layout is run. */
const SCENE_SHIFT_PX = 12;

/** The row counts the demo offers, including none at all. */
export const MOTION_DEMO_ROW_COUNTS: readonly number[] = Object.freeze([0, 3, 8, 20]);

/** One layer of the handover, ready to be placed. */
export interface DemoLayer {
  readonly scene: MotionDemoScene;
  /** 0 to 1. */
  readonly opacity: number;
  /** Vertical offset in pixels, applied as a transform. */
  readonly shiftPx: number;
  /** Should this layer be drawn at all? */
  readonly visible: boolean;
}

/** One row of the staggered list. */
export interface DemoRow {
  readonly index: number;
  readonly delayMs: number;
  readonly durationMs: number;
}

export interface MotionDemoState {
  readonly kind: SceneTransitionKind;
  readonly kinds: readonly SceneTransitionKind[];
  readonly setKind: (kind: SceneTransitionKind) => void;

  /** The scene currently arriving. */
  readonly scene: MotionDemoScene;
  readonly swapScene: () => void;
  readonly phase: ScenePhase;
  readonly isRunning: boolean;
  /** The layer on its way out, drawn only while the handover runs. */
  readonly outgoing: DemoLayer | null;
  /** The layer arriving, or simply the scene on screen. */
  readonly incoming: DemoLayer;

  /** Total length of the current handover, after conditions are applied. */
  readonly totalMs: number;
  readonly overlapMs: number;

  readonly rowCount: number;
  readonly rowCounts: readonly number[];
  readonly setRowCount: (count: number) => void;
  readonly rows: readonly DemoRow[];
  /** Changes whenever the list should replay, so the view can re-key it. */
  readonly replayKey: number;
  readonly replayRows: () => void;
  /** The longest any row waits. Never above the 200 ms ceiling. */
  readonly maxRowDelayMs: number;
  /** How long each row's own entrance takes. The same for every row. */
  readonly rowDurationMs: number;

  readonly lowPerformance: boolean;
  readonly toggleLowPerformance: () => void;
  /** What the operating system was asked for, as opposed to what is simulated. */
  readonly reducedMotion: boolean;
  readonly conditions: MotionConditions;
  readonly frameRate: number;
}

const KINDS: readonly SceneTransitionKind[] = Object.freeze(['view', 'screen', 'floor']);

const OTHER_SCENE: Readonly<Record<MotionDemoScene, MotionDemoScene>> = Object.freeze({
  plan: 'model',
  model: 'plan',
});

export function useMotionDemo(): MotionDemoState {
  const [kind, setKind] = useState<SceneTransitionKind>('view');
  const [scene, setScene] = useState<MotionDemoScene>('plan');
  const [rowCount, setRowCount] = useState<number>(8);
  const [replayKey, setReplayKey] = useState(0);
  const [lowPerformance, setLowPerformance] = useState(false);

  const performanceSignal = useMemo<MotionPerformanceSignal>(
    () => ({ frameRate: lowPerformance ? STRUGGLING_FRAME_RATE : HEALTHY_FRAME_RATE }),
    [lowPerformance],
  );

  const conditions = useMotionConditions(performanceSignal);
  const transition = useSceneTransition(scene, { kind, performanceSignal });

  const plan = useMemo(
    () => planScene({ kind, from: OTHER_SCENE[scene], to: scene, ...conditions }),
    [conditions, kind, scene],
  );

  const rows = useMemo<readonly DemoRow[]>(
    () =>
      staggerSchedule(rowCount, { duration: 'fast', ...conditions }).map((item) => ({
        index: item.index,
        delayMs: item.delayMs,
        durationMs: item.durationMs,
      })),
    [conditions, rowCount],
  );

  const swapScene = useCallback(() => {
    setScene((current) => OTHER_SCENE[current]);
  }, []);

  const replayRows = useCallback(() => {
    setReplayKey((current) => current + 1);
  }, []);

  const toggleLowPerformance = useCallback(() => {
    setLowPerformance((current) => !current);
  }, []);

  const outgoing = useMemo<DemoLayer | null>(() => {
    if (transition.done || transition.from === null) {
      return null;
    }

    return {
      scene: transition.from as MotionDemoScene,
      opacity: 1 - transition.exit,
      shiftPx: -transition.exit * SCENE_SHIFT_PX,
      visible: true,
    };
  }, [transition.done, transition.exit, transition.from]);

  const incoming = useMemo<DemoLayer>(
    () => ({
      scene,
      opacity: transition.enter,
      shiftPx: (1 - transition.enter) * SCENE_SHIFT_PX,
      visible: true,
    }),
    [scene, transition.enter],
  );

  return {
    kind,
    kinds: KINDS,
    setKind,

    scene,
    swapScene,
    phase: transition.phase,
    isRunning: transition.isRunning,
    outgoing,
    incoming,

    totalMs: plan.totalMs,
    overlapMs: plan.overlapMs,

    rowCount,
    rowCounts: MOTION_DEMO_ROW_COUNTS,
    setRowCount,
    rows,
    replayKey,
    replayRows,
    maxRowDelayMs: rows.reduce((longest, row) => Math.max(longest, row.delayMs), 0),

    lowPerformance,
    toggleLowPerformance,
    reducedMotion: conditions.reducedMotion === true,
    conditions,
    frameRate: performanceSignal.frameRate ?? HEALTHY_FRAME_RATE,
    rowDurationMs: conditionedDurationMs('fast', conditions),
  };
}
