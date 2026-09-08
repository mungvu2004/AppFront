/**
 * `S-25` — thư viện model dùng chung. Đường nhập duy nhất của thư mục này.
 *
 * - {@link ModelLibraryContainer} là màn ĐÃ NỐI: một màn khác chỉ cần
 *   `<ModelLibraryContainer />` là mở được, không phải viết thêm một dòng logic thư viện
 *   nào (R-73).
 * - {@link ModelLibraryRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link ModelLibrary} là markup thuần, cho story và test (mục D, R-60).
 * - {@link useModelLibrary} là toàn bộ logic, cho ai muốn dựng một vỏ khác.
 * - {@link createModelLibraryGateway} là cửa vào DUY NHẤT tới dữ liệu thư viện và tới khung
 *   xem trước 3D.
 *
 * Kiểu công khai có đúng **một** nơi định nghĩa — `./types`, hợp đồng đông cứng của bốn
 * worker viết song song — mà container, view, hook và bộ test cùng nhập; barrel này chỉ tái
 * xuất, không chép lại hình dạng.
 *
 * Bốn file anh em (`ModelLibraryToolbar`, `ModelLibrarySummary`, `ModelLibraryTable`,
 * `ModelLibraryDetail`) **không** ra khỏi thư mục: chúng là phần con của một màn, không phải
 * component dùng chung, và R-68 cấm màn này dựng component mới cho cả repo dùng.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { ModelLibrary } from './ModelLibrary';

export { ModelLibraryContainer, ModelLibraryRoute } from './ModelLibrary.container';

export { libraryFilterLabel, MODEL_LIBRARY_TEXT, useModelLibrary } from './useModelLibrary';

export {
  canManageLibrary,
  createModelLibraryGateway,
  modelLibraryCapabilities,
  modelLibraryDetailKey,
  modelLibraryListKey,
} from './modelLibraryGateway';
export type { CreateModelLibraryGatewayOptions } from './modelLibraryGateway';

export type {
  LibraryFilterId,
  LibraryItem,
  ModelLibraryActions,
  ModelLibraryCapabilities,
  ModelLibraryContainerProps,
  ModelLibraryDetailModel,
  ModelLibraryFieldModel,
  ModelLibraryFilterOption,
  ModelLibraryGateway,
  ModelLibraryModel,
  ModelLibraryProps,
  ModelLibraryResult,
  ModelLibraryRowModel,
  ModelLibrarySortKey,
  ModelLibrarySummaryModel,
  ModelLibraryToast,
  ModelLibraryViewMode,
  ModelPreviewModel,
  ModelPreviewSession,
  ModelPreviewState,
  SevenState,
  SortDirection,
  UseModelLibraryOptions,
} from './types';
