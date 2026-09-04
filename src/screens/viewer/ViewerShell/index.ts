/**
 * Cửa nhập của VỎ CHUNG chín màn 3D.
 *
 * Chín màn 3D nhập từ `@/screens/viewer/ViewerShell`, không nhập thẳng file con
 * — nên khi view vượt trần 400 dòng của R-22 và phải tách thêm file anh em,
 * không nơi gọi nào phải sửa theo (mục D).
 *
 * Route nhập {@link ViewerShellContainer}; màn nội dung nhập thêm
 * {@link ViewerSceneFrame} để biết vỏ đưa cho nó những gì.
 */

export { ViewerShell, VIEWER_SHELL_LABEL } from './ViewerShell';
export {
  ViewerShellContainer,
  ViewerShellRoute,
  VIEWER_SHELL_SCREEN_ID,
  type ViewerShellContainerProps,
} from './ViewerShell.container';
export {
  useViewerShell,
  ALL_VIEWER_TOOLS,
  INSPECTOR_HINT,
  SEPARATION_STEP,
  VIEWER_KEY_LABELS,
  type UseViewerShellOptions,
} from './useViewerShell';

export {
  createViewerShellFixtureGateway,
  createViewerShellGateway,
  footprintOf,
  shellDataOf,
  storeysOf,
  VIEWER_EMPTY_SPATIAL,
  VIEWER_FIXTURE_SPATIAL,
  VIEWER_MISSING_CAPABILITIES,
  VIEWER_PARTIAL_SPATIAL,
  type ViewerShellData,
  type ViewerShellGateway,
  type ViewerStorey,
} from './viewerShellGateway';

export {
  buildDeselectShortcut,
  buildViewerShortcuts,
  type ViewerShortcutHandlers,
} from './viewerShellShortcuts';

export {
  clampSeparation,
  stackedHeightMm,
  stackStoreys,
  storeySpreadMm,
  type StackableStorey,
  type StackedStorey,
} from './viewerStoreyStack';

export {
  clampSectionPosition,
  isClipped,
  sectionDistanceM,
  sectionPlaneFor,
  type ViewerBoundsM,
  type ViewerSectionAxis,
} from './viewerSectionPlane';

export {
  VIEWER_SCREEN_STATES,
  VIEWER_SHELL_SCENARIOS,
  type ViewerShellScenario,
} from './viewerShellScenarios';

export {
  VIEWER_LAYOUT,
  type ViewerSceneFrame,
  type ViewerScreenState,
  type ViewerSectionPlaneValue,
  type ViewerShellProps,
  type ViewerStoreyViewModel,
  type ViewerToolId,
} from './viewerShellTypes';
