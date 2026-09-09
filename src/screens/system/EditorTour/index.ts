/**
 * Lớp phủ dạy việc sáu bước — chạy đè lên màn QC/3D lần đầu người dùng mở
 * trình soạn thảo. Đường nhập duy nhất của thư mục này.
 *
 * - {@link EditorTourContainer} là lớp đã nối — ranh giới lỗi + `useSession()`
 *   + hook, cho một màn chủ đã có provider (R-73: chỉ cần một dòng để mở).
 * - {@link EditorTour} là markup thuần, cho story và test.
 * - {@link useEditorTour} là máy trạng thái + cờ đã xem, cho ai cần tự nối
 *   theo cách khác `EditorTourContainer`.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bốn người dựng màn này song song từ một hợp đồng đông cứng
 * (`scratchpad/editortour/CONTRACT.md`). Ranh giới dưới đây tồn tại để không
 * ai phải chờ ai, và để không ai phải sửa file của người khác:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `useEditorTour.ts` | 2A | kiểu dùng chung (mục 3 hợp đồng) + bảng bước + máy trạng thái + cờ đã xem |
 * | `EditorTour.tsx` | 2B | view thuần: thẻ, nền khoét, chấm, tấm trượt đáy |
 * | `EditorTour.test.tsx` · `EditorTour.stories.tsx` | 2C | bảy trạng thái + tiếp cận + tiếng Việt + bảy story |
 * | `EditorTour.container.tsx` · `index.ts` | 2D | ranh giới lỗi + nối đủ props (R-62, R-73) + đường nhập ổn định |
 * | `src/i18n/vi.json` | 3A | 2D ghi `vi.json.fragment` ở gốc repo; 3A trộn (một chủ duy nhất) |
 *
 * Kiểu ở mục 3 hợp đồng (`TourStepId`, `TourStepView`, `EditorTourProps`,
 * `UseEditorTourOptions`, …) là **một nguồn duy nhất**: khai trong
 * `useEditorTour.ts`, mọi file khác nhập bằng `import type`, không khai lại.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { EditorTourContainer } from './EditorTour.container';
export type { EditorTourContainerProps } from './EditorTour.container';
export { EditorTour } from './EditorTour';
export { TOUR_STEP_IDS, useEditorTour } from './useEditorTour';
export type {
  EditorTourProps,
  TourPlacement,
  TourRect,
  TourStepId,
  TourStepView,
  TourSummaryRow,
  UseEditorTourOptions,
  UseEditorTourResult,
} from './useEditorTour';
