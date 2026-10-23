/**
 * Bảng màu của MỘT trạng thái đơn vị xử lý ({@link ProcessingStageStatus}),
 * dùng chung giữa `ProcessingFloorChips` (dãy chip tầng) và `ProcessingStepList`
 * / `ProcessingStepBar` (cây bước). Cùng một khái niệm thì tô cùng một màu — đó
 * là lý do bảng nằm ở đây chứ không bị chép ra ba chỗ.
 *
 * ## A1 — không mã màu thô
 *
 * Mọi giá trị dưới đây là lớp Tailwind trỏ vào token (`--state-attention`,
 * `--state-verified`, `--state-violation`, `--text-muted`). Không hex, không
 * rgb, không hsl.
 *
 * ## A4 — đúng ba màu trạng thái, không có màu thứ tư
 *
 * `running` → `attention`, `done` → `verified`, `failed` → `violation`. Đó là
 * ba màu, và chỉ ba. `queued` KHÔNG được cấp màu thứ tư: nó mượn chữ trung tính
 * `--text-muted` / nền `--bg-sunken`, đúng khuôn biến thể `neutral` của `Badge`
 * (`src/components/ui/Badge.tsx:22,29`) — "chưa có phán quyết nào" thì không
 * phải một trạng thái để tô, và cấp cho nó một màu riêng là đúng thứ A4 tồn tại
 * để chặn.
 *
 * ## A5 — bước máy chạy xong là trung tính
 *
 * A5 dành xanh "đã xác minh" cho việc NGƯỜI duyệt. Một bước AI chạy xong không
 * phải người duyệt, nên `done` dùng chữ phụ (`text-secondary`), không dùng xanh
 * `verified` (aesthetic 2.5 #2) — trước đây trên màn xanh của máy trông y hệt
 * xanh của người duyệt.
 */

import type { ProcessingStageStatus } from './types';

/** Chấm tròn đặc — chip tầng và đầu hàng bước. */
export const STAGE_DOT_CLASS: Readonly<Record<ProcessingStageStatus, string>> = {
  queued: 'bg-text-muted',
  running: 'bg-state-attention',
  done: 'bg-text-secondary',
  failed: 'bg-state-violation',
};

/** Màu chữ tên bước / tên tầng. `queued` giữ chữ thường của thân màn. */
export const STAGE_TEXT_CLASS: Readonly<Record<ProcessingStageStatus, string>> = {
  queued: 'text-text-secondary',
  running: 'text-text-primary',
  done: 'text-text-primary',
  failed: 'text-state-violation-text',
};

/** Phần đã chạy của thanh tiến độ 3px. */
export const STAGE_BAR_CLASS: Readonly<Record<ProcessingStageStatus, string>> = {
  queued: 'bg-text-muted',
  running: 'bg-state-attention',
  done: 'bg-text-secondary',
  failed: 'bg-state-violation',
};

/** Màu nét của biểu tượng đứng đầu hàng bước. */
export const STAGE_ICON_CLASS: Readonly<Record<ProcessingStageStatus, string>> = {
  queued: 'text-text-muted',
  running: 'text-state-attention',
  done: 'text-text-secondary',
  failed: 'text-state-violation',
};
