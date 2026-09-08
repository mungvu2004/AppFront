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

/**
 * Cảnh 3D chỉ tái xuất KIỂU, không tái xuất giá trị.
 *
 * `mountExplodedScene` và `EXPLODED_MAX_FPS` từng ra khỏi đây như giá trị, và
 * một lượt tái xuất giá trị là một lượt nhập tĩnh: `three` cùng
 * `src/lib/three/build` (136,7 KiB gzip) đi thẳng vào chunk của màn, kể cả khi
 * `useExplodedView` đã chuyển sang `import()` động. Không nơi gọi nào trong
 * `src/` dùng hai cái tên ấy — đường dùng chúng là `options.mountScene` của
 * container, và nó nhận KIỂU chứ không nhận module. Ai thật sự cần chính cảnh
 * thì nhập `./explodedViewScene`, và nhận lấy `three` một cách có ý thức.
 */
export type {
  ExplodedSceneHandle,
  ExplodedSceneMountOptions,
  MountExplodedScene,
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

/*
 * `explodedViewScenarios.ts` KHÔNG được tái xuất ở đây, và đó là một quyết định
 * về kích thước gói chứ không phải một chỗ bỏ sót.
 *
 * Router lazy-import chính cửa nhập này, nên mọi thứ cửa này nhắc tên đều rơi vào
 * chunk mà người dùng tải khi bước vào màn. Bảy kịch bản là 420 dòng dữ liệu mẫu
 * phục vụ story và bài kiểm; đẩy chúng vào gói sản phẩm làm màn vượt ngân sách
 * 280 KiB của cổng kích thước gói.
 *
 * Story và bài kiểm nhập thẳng `./explodedViewScenarios` — chúng nằm cùng thư mục
 * nên không cần đi vòng qua cửa nhập, và cách ấy giữ dữ liệu mẫu ở đúng phía biên
 * giới sản phẩm.
 */
