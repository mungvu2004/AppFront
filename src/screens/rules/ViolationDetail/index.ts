/**
 * Tấm trượt chi tiết vi phạm (S-34) — đường nhập duy nhất của thư mục này.
 *
 * Khác `../RuleReport`, ở đây **không có `*Route`**: S-34 là một tấm trượt mở TRÊN
 * màn báo cáo luật, không phải một trang có đường dẫn riêng, nên `src/routes/router.tsx`
 * không mount gì từ đây (R-66 không áp; R-73 vẫn áp).
 *
 * - {@link ViolationDetailContainer} là tấm trượt đã nối dây, cho màn cha mở nó bằng
 *   đúng một thẻ với danh sách vi phạm mà chính cha vừa có.
 * - {@link ViolationDetail} là markup thuần, cho story và test.
 * - {@link useViolationDetail} là toàn bộ logic, tách rời view (mục D).
 *
 * `ViolationDetailViewProps` (và mọi kiểu con của nó) có đúng **một** nơi định nghĩa —
 * `./types` — mà cả hook lẫn view cùng nhập; barrel này chỉ tái xuất, không chép lại
 * hình dạng.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { ViolationDetail } from './ViolationDetail';

export { ViolationDetailContainer } from './ViolationDetail.container';
export type { ViolationDetailContainerProps } from './ViolationDetail.container';

export { useViolationDetail } from './useViolationDetail';
export type { UseViolationDetailOptions } from './useViolationDetail';

export type {
  ViolationAction,
  ViolationActionKind,
  ViolationCause,
  ViolationDetailCapabilities,
  ViolationDetailState,
  ViolationDetailViewProps,
  ViolationFigureMode,
  ViolationObject,
} from './types';
