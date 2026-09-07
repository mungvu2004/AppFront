/**
 * Cửa nhập DUY NHẤT của màn Tách tầng.
 *
 * Cùng khuôn `ViewerShell/index.ts` (mục D): view của màn này đã phải tách làm
 * bốn file anh em để không vượt trần 400 dòng của R-22, nên nơi gọi nhập từ
 * `@/screens/viewer/ExplodedView` chứ không nhập thẳng file con — tách thêm một
 * file nữa về sau thì không nơi gọi nào phải sửa theo.
 *
 * Router nhập {@link ExplodedViewRoute}; một màn khác muốn nhúng màn này nhập
 * {@link ExplodedViewContainer} và mở nó bằng đúng một thẻ (R-73).
 */

export { ExplodedView } from './ExplodedView';
export {
  ExplodedViewContainer,
  ExplodedViewRoute,
  EXPLODED_VIEW_SCREEN_ID,
  type ExplodedViewContainerProps,
} from './ExplodedView.container';
export {
  useExplodedView,
  activePresetIdOf,
  explodedViewPropsOf,
  EXPLODE_CYCLE_COMBO,
  type ExplodedViewRuntime,
  type UseExplodedViewScreenOptions,
} from './useExplodedView';

export {
  alignmentOf,
  axisProbesOf,
  createExplodedViewFixtureGateway,
  createExplodedViewGateway,
  floorAreasOf,
  floorProbesOf,
  EXPLODED_MISSING_CAPABILITIES,
  type ExplodedAxisProbe,
} from './explodedViewGateway';

export {
  mountExplodedScene,
  EXPLODED_MAX_FPS,
  type ExplodedSceneHandle,
  type ExplodedSceneMountOptions,
  type MountExplodedScene,
} from './explodedViewScene';

export {
  EXPLODE_PRESETS,
  EXPLODED_LAYOUT,
  EXPLODED_MOTION_MS,
  DIMMED_FLOOR_OPACITY,
  LABEL_REVEAL_SEPARATION,
  type AlignmentReportLike,
  type AlignmentTone,
  type ExplodedAlignmentPath,
  type ExplodedElevationTick,
  type ExplodedFloorProbe,
  type ExplodedFloorViewModel,
  type ExplodedViewActions,
  type ExplodedViewGateway,
  type ExplodedViewModel,
  type ExplodedViewProps,
  type ExplodedViewState,
  type ExplodePresetId,
  type ExplodePresetViewModel,
  type UseExplodedViewOptions,
} from './explodedViewTypes';

export {
  explodedViewScenarioFor,
  withReducedMotion,
  withSeparation,
  EXPLODED_VIEW_SCENARIOS,
  EXPLODED_VIEW_STATES,
  SAMPLE_ALIGNMENT_ISSUE,
  SAMPLE_MISALIGNED_FLOORS,
  type ExplodedViewScenario,
} from './explodedViewScenarios';
