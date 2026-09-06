/**
 * Cửa nhập ổn định của panel `FurnitureLibraryPanel`.
 *
 * Màn cha viết `@/screens/viewer/FurnitureLibraryPanel` và không phải biết panel
 * này gồm mấy file. Khi view hoặc hook vượt trần 400 dòng của R-22 và phải tách
 * thêm file anh em, không nơi gọi nào phải sửa theo (mục D) — cùng khuôn
 * `PropertyInspector/index.ts`, `ViewerShell/index.ts` và `Viewer3D/index.ts`.
 *
 * Ba nhóm đi ra khỏi đây:
 *
 * - `FurnitureLibraryPanelContainer` — panel đã nối dây, gắn được bằng một thẻ
 *   (R-73); `FURNITURE_LIBRARY_PANEL_SCREEN_ID` đi cùng nó cho ranh giới lỗi và
 *   cho nhật ký.
 * - `FurnitureLibraryPanel` — view thuần, thứ story và bài kiểm bảy trạng thái
 *   dựng thẳng; `useFurnitureLibraryPanel` — nửa "suy nghĩ", cho màn cha muốn
 *   tự dựng view thay vì dùng container.
 * - Mọi hằng số và kiểu dùng chung của `furnitureLibraryPanelTypes.ts`: bảy
 *   trạng thái, mười nhóm chip, số đo bố cục cố định.
 *
 * Cổng dữ liệu (`furnitureLibraryPanelGateway.ts`) KHÔNG đi ra: nó là phần bên
 * trong của panel, và một màn cha gọi thẳng vào đó là một màn cha đang dựng lại
 * panel này lần thứ hai.
 */

export { FurnitureLibraryPanel } from './FurnitureLibraryPanel';
export {
  FurnitureLibraryPanelContainer,
  FURNITURE_LIBRARY_PANEL_SCREEN_ID,
} from './FurnitureLibraryPanel.container';
export { useFurnitureLibraryPanel } from './useFurnitureLibraryPanel';

export {
  FURNITURE_CATEGORY_IDS,
  FURNITURE_CATEGORY_LABELS,
  FURNITURE_LIBRARY_PANEL_LAYOUT,
  type DetectedFurnitureGroup,
  type FurnitureCategoryChip,
  type FurnitureCategoryId,
  type FurnitureLibraryEmptyVariant,
  type FurnitureLibraryPanelCollapsedState,
  type FurnitureLibraryPanelContainerProps,
  type FurnitureLibraryPanelContent,
  type FurnitureLibraryPanelEmptyState,
  type FurnitureLibraryPanelErrorState,
  type FurnitureLibraryPanelForbiddenState,
  type FurnitureLibraryPanelLoadingState,
  type FurnitureLibraryPanelPartialState,
  type FurnitureLibraryPanelProps,
  type FurnitureLibraryPanelState,
  type FurnitureLibraryPanelStateKind,
  type FurnitureLibraryPanelSuccessState,
  type FurnitureModelCard,
  type FurnitureModelCardMotion,
  type ModelThumbnailStatus,
  type ReplaceAllPreview,
  type ReplaceAllPreviewItem,
  type UseFurnitureLibraryPanelOptions,
  type UseFurnitureLibraryPanelResult,
} from './furnitureLibraryPanelTypes';
