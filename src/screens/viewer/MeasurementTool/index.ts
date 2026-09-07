/**
 * Cửa nhập DUY NHẤT của màn Công cụ đo.
 *
 * Cùng khuôn `ExplodedView/index.ts` (mục D): view của màn này đã phải tách làm
 * nhiều file anh em để không vượt trần 400 dòng của R-22, nên nơi gọi nhập từ
 * `@/screens/viewer/MeasurementTool` chứ không nhập thẳng file con — tách thêm
 * một file nữa về sau thì không nơi gọi nào phải sửa theo.
 *
 * Router nhập {@link MeasurementToolRoute}; một màn khác muốn nhúng màn này
 * nhập {@link MeasurementToolContainer} và mở nó bằng đúng một thẻ (R-73).
 */

export { MeasurementTool } from './MeasurementTool';
export {
  MeasurementToolContainer,
  MeasurementToolRoute,
  MEASUREMENT_TOOL_SCREEN_ID,
  type MeasurementToolContainerProps,
} from './MeasurementTool.container';
export { MeasurementList } from './MeasurementList';
export { MeasurementOverlay } from './MeasurementOverlay';
export { MeasurementSnapChip } from './MeasurementSnapChip';
export { useMeasurementTool, type UseMeasurementToolOptions } from './useMeasurementTool';

export {
  MEASURE_MODES,
  MEASURE_MODE_LABELS,
  MEASURE_UNITS,
  MEASURE_UNIT_LABELS,
  SNAP_KINDS,
  SNAP_KIND_LABELS,
  type DraftMeasurement,
  type MeasureMode,
  type MeasureUnit,
  type MeasurementScreenState,
  type MeasurementToolGateway,
  type MeasurementToolProps,
  type PinnedMeasurement,
  type PinnedMeasurementId,
  type ScreenPoint,
  type SnapIndicator,
  type SnapKind,
} from './measurementToolTypes';

/*
 * `measurementToolScenarios.ts` KHÔNG được tái xuất ở đây, và đó là một quyết
 * định về kích thước gói chứ không phải một chỗ bỏ sót.
 *
 * Router lazy-import chính cửa nhập này, nên mọi thứ cửa này nhắc tên đều rơi
 * vào chunk mà người dùng tải khi bước vào màn. Bảy kịch bản là dữ liệu mẫu
 * phục vụ story và bài kiểm; đẩy chúng vào gói sản phẩm làm màn ăn vào ngân
 * sách 280 KiB của cổng kích thước gói, mà cổng ấy hiện chỉ còn 0,3 KiB.
 *
 * Story và bài kiểm nhập thẳng `./measurementToolScenarios` — chúng nằm cùng
 * thư mục nên không cần đi vòng qua cửa nhập, và cách ấy giữ dữ liệu mẫu ở đúng
 * phía biên giới sản phẩm.
 *
 * `measurementToolScene.ts` cũng không tái xuất: hook là nơi duy nhất gọi nó,
 * và một cửa nhập nhắc tên module cảnh sẽ kéo `WebGLRenderer` vào mọi nơi gọi.
 */
