/**
 * Cửa nhập của màn `Viewer3D` — mô hình 3D cắm vào khe cảnh của vỏ chung.
 *
 * Nơi gọi nhập từ `@/screens/viewer/Viewer3D`, không nhập thẳng file con — nên
 * khi view vượt trần 400 dòng của R-22 và phải tách thêm file anh em, không nơi
 * gọi nào phải sửa theo (mục D).
 *
 * Router nhập `Viewer3DRoute`; một màn khác muốn nhúng khung nhìn 3D nhập
 * `Viewer3DContainer` và truyền `projectId` (R-73).
 */

export { Viewer3D } from './Viewer3D';
export {
  ObjectSearch,
  NO_MATCH_MESSAGE,
  OPEN_SEARCH_LABEL,
  SEARCH_INPUT_LABEL,
  SEARCH_LIST_LABEL,
  type ObjectSearchProps,
} from './ObjectSearch';
/*
 * `foldForSearch` KHÔNG còn được xuất ở đây — nó đã xuống `@/lib/format/fold`.
 *
 * Bốn màn ngoài `Viewer3D` cần bỏ dấu khi tìm, và việc chúng với tay vào thư
 * mục của một màn khác để lấy nó là một vi phạm ranh giới tầng (mục 0.4:
 * `src/screens/**` là tầng cao nhất, không ai được nhập từ nó). Nó tự lộ ra
 * thành một vòng import khi màn này gắn `FurnitureLibraryPanel`.
 */
export {
  matchRoomOptions,
  MAX_ROOM_RESULTS,
  type RoomSearchResult,
  type ViewerRoomOption,
} from './roomSearch';
export {
  Viewer3DContainer,
  Viewer3DRoute,
  VIEWER_3D_SCREEN_ID,
  type Viewer3DContainerProps,
} from './Viewer3D.container';
export { useViewer3D } from './useViewer3D';

export { mountViewerScene, applyDetailLevel, VIEWER_MAX_FPS } from './viewer3dScene';

export type {
  MountViewerScene,
  UseViewer3DOptions,
  Viewer3DModel,
  Viewer3DProps,
  Viewer3DSearchData,
  Viewer3DSearchModel,
  Viewer3DTelemetry,
  ViewerFrameRateEvent,
  ViewerRendererLike,
  ViewerScenePhase,
  ViewerSceneProgress,
  ViewerSceneStatus,
  ViewerSceneFrameRate,
  ViewerSceneHandle,
  ViewerSceneInjections,
  ViewerSceneMount,
  ViewerSceneMountOptions,
} from './viewer3dTypes';
