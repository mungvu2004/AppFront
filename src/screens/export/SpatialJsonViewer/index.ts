/**
 * `S-36` — màn xem Spatial JSON. Đường nhập duy nhất của thư mục này.
 *
 * - {@link SpatialJsonViewerContainer} là màn ĐÃ NỐI: `<SpatialJsonViewerContainer projectId />`
 *   là đủ để một màn khác mở nó, không phải viết thêm một dòng logic nào (R-73).
 * - {@link SpatialJsonViewerRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link SpatialJsonViewer} là markup thuần, cho story và test (mục D, R-60).
 * - {@link useSpatialJsonViewer} là toàn bộ logic, cho ai muốn dựng một vỏ khác.
 *
 * Kiểu công khai định nghĩa đúng một chỗ — `./types` — mà view, hook, container
 * và bộ test cùng nhập; barrel này chỉ tái xuất.
 *
 * `SpatialJsonTree` và `SpatialJsonDetail` **không** ra khỏi thư mục: chúng là
 * phần con của một màn, không phải component dùng chung (R-68).
 */

export { SpatialJsonViewer } from './SpatialJsonViewer';

export { SpatialJsonViewerContainer, SpatialJsonViewerRoute } from './SpatialJsonViewer.container';

export { useSpatialJsonViewer } from './useSpatialJsonViewer';
export type { UseSpatialJsonViewerOptions, UseSpatialJsonViewerResult } from './useSpatialJsonViewer';

export type {
  SpatialJsonCounts,
  SpatialJsonIssue,
  SpatialJsonNode,
  SpatialJsonTabId,
  SpatialJsonTone,
  SpatialJsonValidity,
  SpatialJsonViewerActions,
  SpatialJsonViewerContainerProps,
  SpatialJsonViewerModel,
  SpatialJsonViewerProps,
  SpatialJsonViewMode,
} from './types';
