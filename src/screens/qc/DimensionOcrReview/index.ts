/**
 * Đường nhập ổn định của màn S-14 "Đọc kích thước OCR" (`DimensionOcrReview`).
 *
 * Màn cha viết `@/screens/qc/DimensionOcrReview` và không phải biết màn này gồm
 * mấy file. Thư mục có nhiều hơn sáu tên chuẩn của R-59, và đó là điều QĐ-3 của
 * điều phối viên cho phép: view vượt trần 400 dòng của R-22 thì phần con tách ra
 * file anh em, miễn `index.ts` giữ nguyên đường nhập. Tiền lệ:
 * `ObjectLayerReview/` (18 file), `WallLayerReview/` (20 file).
 *
 * Năm nhóm đi ra khỏi đây, và không có nhóm thứ sáu:
 *
 * - `DimensionOcrReviewContainer` — màn đã nối dây, gắn được bằng một thẻ (R-73).
 * - `DimensionOcrReviewRoute` — vỏ route, thứ duy nhất biết tới `react-router-dom`;
 *   `src/routes/router.tsx` lazy-import đúng tên này.
 * - `DimensionOcrReview` — view thuần, thứ story và bài kiểm bảy trạng thái dựng thẳng.
 * - `useDimensionOcrReview` — nửa "suy nghĩ", cho màn cha muốn tự dựng view.
 * - Cổng dữ liệu, bộ mẫu và bảy kịch bản: test và story phải cắm được bản giả
 *   vào (R-73), và cắm CÙNG một bộ mẫu thay vì bịa bảng dữ liệu thứ hai (R-70).
 *
 * KHÔNG tái xuất phần con nào của view (`DimensionOcrCanvas`, `DimensionOcrList`,
 * `DimensionOcrRow`, `DimensionOcrCompareBar`, `DimensionOcrKeyboardMode`):
 * chúng là mảnh của MỘT view, không phải API của màn — cùng lý lẽ
 * `ObjectLayerReview/index.ts`. Riêng các hợp đồng props thì ĐI RA, vì đó là
 * hình dạng mà nơi gọi phải biết khi tự dựng view từ `useDimensionOcrReview`.
 */

export { DimensionOcrReview, type DimensionOcrReviewViewProps } from './DimensionOcrReview';
export {
  DimensionOcrReviewContainer,
  DimensionOcrReviewRoute,
  DIMENSION_OCR_REVIEW_SCREEN_ID,
  type DimensionOcrReviewContainerProps,
} from './DimensionOcrReview.container';
export {
  useDimensionOcrReview,
  applyDimensionFilters,
  deriveScreenState,
  nextUnreviewedId,
  type DimensionOcrCompareModel,
  type DimensionOcrKeyboardReviewModel,
  type DimensionOcrReviewModel,
  type DimensionOcrRowModel,
  type UseDimensionOcrReviewOptions,
} from './useDimensionOcrReview';
export {
  createDimensionOcrReviewGateway,
  createMockDimensionOcrReviewGateway,
  buildDimensionOcrGraph,
  dimensionProgressLabel,
  reviewCounterOf,
  DIMENSION_APPROVE_COMMAND_TYPE,
  DIMENSION_OCR_CAPABILITIES,
  DIMENSION_OCR_MISSING_CAPABILITIES,
  DIMENSION_OCR_MISSING_ENDPOINTS,
  DIMENSION_OCR_SAMPLE_GRAPH,
  DIMENSION_OCR_SAMPLE_IMAGE,
  DIMENSION_OCR_SAMPLE_LEVEL,
  DIMENSION_OVERRIDE_COMMAND_TYPE,
  type DimensionOcrGatewaySeed,
  type DimensionOcrReviewGateway,
} from './dimensionOcrReviewGateway';
export { DIMENSION_OCR_TEXT } from './dimensionOcrText';
export {
  DIMENSION_OCR_FIXTURE_DIMENSIONS,
  DIMENSION_OCR_FIXTURE_DONE,
  DIMENSION_OCR_FIXTURE_EMPTY,
  DIMENSION_OCR_FIXTURE_LEVEL,
  DIMENSION_OCR_FIXTURE_LOW_CONFIDENCE,
  DIMENSION_OCR_FIXTURE_MINOR_DEVIATION,
  DIMENSION_OCR_FIXTURE_PARTIAL,
  DIMENSION_OCR_FIXTURE_REVIEWED,
  DIMENSION_OCR_FIXTURE_SIGNIFICANT_DEVIATION,
  DIMENSION_OCR_FIXTURE_TOTAL,
} from './dimensionOcrFixture';
export {
  dimensionOcrScenarioFor,
  DIMENSION_OCR_REVIEW_SCENARIOS,
  type DimensionOcrReviewScenario,
} from './dimensionOcrReviewScenarios';

export type {
  DimensionChainViewModel,
  DimensionCompareViewModel,
  DimensionCropViewModel,
  DimensionFilterId,
  DimensionOcrCanvasProps,
  DimensionOcrCompareBarProps,
  DimensionOcrKeyboardModeProps,
  DimensionOcrListProps,
  DimensionOcrModel,
  DimensionOcrRowProps,
  DimensionOcrScreenState,
  DimensionPixelPoint,
  DimensionPixelRect,
  DimensionReviewCounter,
  DimensionRowViewModel,
} from './dimensionOcrTypes';
