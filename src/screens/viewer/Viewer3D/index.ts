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

export { Viewer3D, type Viewer3DProps as Viewer3DViewProps } from './Viewer3D';
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
  Viewer3DProps,
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
