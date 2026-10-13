/**
 * Hợp đồng giữa màn hình AppFront và gói vách ngăn Pascal.
 *
 * Để riêng khỏi `pascalMount.tsx` vì màn hình phải khai được kiểu của hàm gọi
 * lại mà **không** nhập tệp ấy: nhập nó là kéo cả Pascal vào gói chính, và cổng
 * "chi phí thêm cho một màn" đo được đúng điều đó. Tệp này không nhập
 * `@pascal-app/*` nào, nên nó qua được cổng nhập mà vẫn là một nguồn duy nhất.
 */

import type { PascalScene } from '@/lib/pascal/types';

/** Khung Pascal dựng ra cái gì: khung xem thuần, hay trình soạn thảo đầy đủ. */
export type PascalMountMode = 'view' | 'edit';

/**
 * Trạng thái lưu mà editor Pascal báo ra (`SaveStatus` của `use-auto-save.ts`).
 *
 * Chép đúng bộ giá trị ấy thay vì `import type` xuyên tường: cổng nhập gói
 * Pascal chặn cả nhập kiểu ngoài `src/components/pascal` và `src/lib/pascal`,
 * còn `usePascalViewer` thì nằm ở `src/screens`.
 */
export type PascalSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'paused' | 'error';

/** Công cụ editor bật sẵn khi khung đứng — `measure` cho `/3d?tool=measure` (F-15 W2-B). */
export type PascalInitialTool = 'measure';

/** Phán quyết 6A cho một lượt sửa: cho qua, hoặc chặn kèm lý do tiếng Việt. */
export type PascalCommitVerdict = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Câu trả lời của host cho "Lưu làm khuôn mẫu" (#25) — Pascal hiện nguyên `message`. */
export interface PascalTemplateResult {
  readonly ok: boolean;
  readonly message: string;
}

/** Cảnh sau một lượt sửa, trên đường thành một lệnh AppFront. */
export type PascalSceneCommit = (scene: PascalScene) => Promise<void>;

/**
 * Một cú nhảy lịch sử NGƯỜI DÙNG vừa làm — `undo` hoặc `redo`.
 *
 * Chép đúng bộ giá trị của `HistoryJumpKind` (`editor/src/lib/history.ts`)
 * thay vì `import type` xuyên tường, cùng lý do `PascalSaveStatus` ở trên.
 */
export type PascalHistoryJump = 'undo' | 'redo';

/** Một lượt đo hai điểm ở khung xem; host định dạng số theo A15. */
export interface PascalMeasureResult {
  readonly distanceM: number;
}

/**
 * Người dùng vừa xoá một phép đo đã ghim (#63, A8). `ordinal` là số thứ tự của
 * nó trong tầng ("Đã xoá phép đo N"); `undo` là đúng cú hoàn tác của editor.
 */
export interface PascalMeasurementDelete {
  readonly ordinal: number;
  readonly undo: () => void;
}
