/**
 * The motion vocabulary: four durations, three curves, and the machinery that
 * plays them. Import from here rather than from the individual files.
 *
 * Nothing in this folder imports React — the hooks that wrap it live in
 * `src/hooks/useTransition.ts` and `src/hooks/useReducedMotion.ts`.
 */

export {
  AMBIENT_LOOP_MS,
  clampProgress,
  cssDurationMs,
  durationMs,
  durationSeconds,
  easingOf,
  MILLISECONDS_PER_SECOND,
  MOTION_DURATION_NAMES,
  MOTION_DURATIONS_MS,
  MOTION_EASING_NAMES,
  MOTION_EASINGS,
  type CubicBezierPoints,
  type MotionDurationName,
  type MotionEasing,
  type MotionEasingName,
  type ReducedMotionOption,
} from './tokens';

export {
  createTransition,
  DEFAULT_MOTION_EASING,
  defaultFrameScheduler,
  sampleTransition,
  type CreateTransitionOptions,
  type FrameScheduler,
  type Transition,
  type TransitionDirection,
  type TransitionSample,
  type TransitionSpec,
} from './transition';

export {
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  subscribeReducedMotion,
  type MediaMatcher,
} from './reducedMotion';

export {
  assertComposited,
  COMPOSITED_PROPERTIES,
  conditionedDurationMs,
  conditionsFor,
  createSceneOrchestrator,
  frameAt,
  isCompositedProperty,
  isLowPerformance,
  layoutTriggeringIn,
  LOW_FRAME_RATE,
  planScene,
  SCENE_TIMINGS,
  type CompositedProperty,
  type MotionConditions,
  type MotionPerformanceSignal,
  type PhaseWindow,
  type SceneFrame,
  type SceneOrchestrator,
  type ScenePhase,
  type ScenePlan,
  type SceneTiming,
  type SceneTransitionKind,
  type SceneTransitionSpec,
  type SupersededScene,
} from './orchestrate';

export {
  MAX_STAGGERED_ITEMS,
  maxStaggerMs,
  STAGGER_BUDGET_MS,
  STAGGER_STEP_MS,
  staggerDelayMs,
  staggerDelaysMs,
  staggerSchedule,
  staggerScheduleEndMs,
  type StaggeredItem,
  type StaggerScheduleOptions,
} from './stagger';

export {
  diffListKeys,
  LIST_MOTION_ITEM_LIMIT,
  planListMotion,
  preservedScrollTopPx,
  scrollAnchorOf,
  type ListDiff,
  type ListEnterMotion,
  type ListExitMotion,
  type ListItemLayout,
  type ListKey,
  type ListKeyMove,
  type ListKeyPlacement,
  type ListMotionPlan,
  type ListMoveMotion,
  type ScrollAnchor,
} from './listMotion';

export {
  createSidePanelResizeDrag,
  planSidePanelSnapBack,
  planSidePanelToggle,
  SIDE_PANEL_SNAP_MODES,
  SIDE_PANEL_WIDTHS_PX,
  sidePanelEdgeOffsetPx,
  sidePanelWidthPx,
  snapSidePanelMode,
  type SidePanelMode,
  type SidePanelMotionPlan,
  type SidePanelResizeDrag,
  type SidePanelSettle,
} from './sidePanel';

export {
  COUNT_UP_DURATION,
  COUNT_UP_EASING,
  createCountUp,
  sampleCountUp,
  type CountUp,
  type CountUpSample,
  type CountUpSpec,
} from './useCountUp';

/**
 * The framer-motion shaped constants the shipped overlays already import.
 * Deprecated for new code — see `framer.ts`.
 */
export { DURATION, EASE, SPRING } from './framer';
