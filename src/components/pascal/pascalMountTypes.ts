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

/** Cái `loadSceneIntoPascal` trả về, đủ để nơi gọi tự kiểm mà không cần chạm store Pascal. */
export interface PascalSceneCensus {
  /** Số node thật sự nằm trong store sau lượt nạp. */
  readonly nodeCount: number;
  /** Node bị store dọn đi vì mồ côi hoặc không với tới được từ gốc. */
  readonly droppedIds: readonly string[];
}

/** Cái người gọi cầm về, đủ để sống trọn vòng đời mà không chạm vào Pascal. */
export interface PascalMountHandle {
  /** Nạp một cảnh khác vào cùng khung đang chạy. */
  readonly setScene: (scene: PascalScene) => void;
  /** Khuôn camera vào một đối tượng theo mã AppFront; `false` khi không có node nào mang mã ấy. */
  readonly frameEntity: (entityId: string) => boolean;
  /** Tô sáng các node theo mã Pascal; mảng rỗng là bỏ tô sáng. */
  readonly setHighlight: (nodeIds: readonly string[]) => void;
  /** Xoá node theo mã Pascal như nút "Xoá" của editor (lượt xoá hàng loạt đã xác nhận). */
  readonly deleteNodes: (nodeIds: readonly string[]) => void;
  /** Gỡ gốc React thứ hai và trả store về rỗng. Gọi được nhiều lần. */
  readonly dispose: () => void;
}

/** Những gì màn hình cha cần nói cho khung nhúng biết. */
export interface PascalMountOptions {
  /** Cảnh đầu tiên. Đã phải đủ trường — xem `lib/pascal/__tests__/renderContract.test.ts`. */
  readonly scene: PascalScene;
  /** Cảnh đã dựng xong một khung hình thật, hoặc chưa. */
  readonly onReadyChange?: (ready: boolean) => void;
  /** Lỗi chết người ở gốc thứ hai. `ScreenErrorBoundary` không với tới đây được. */
  readonly onFatal?: (error: Error) => void;
  /** Số node vào store và số node store dọn đi — xem `PascalFrameProps.onSceneLoaded`. */
  readonly onSceneLoaded?: (census: PascalSceneCensus) => void;
  /** Xoay một ngón, chụm để thu phóng, hai ngón để dời (chuột: kéo, lăn). */
  readonly cameraControls?: boolean;
  /** Đặt camera khi cảnh sẵn sàng: `hero` (mặc định, góc ảnh đại diện) hoặc `scene` (vừa khung bao cả cảnh). */
  readonly fit?: 'hero' | 'scene';
  /** Chạm/bấm một đối tượng ở `view` — mã node Pascal, hoặc `null` khi chạm khoảng trống. */
  readonly onPick?: (nodeId: string | null) => void;
  /** Bật đo hai điểm ở `view`: khi bật, chạm không còn gọi `onPick`. */
  readonly measure?: boolean;
  /** Một lượt đo xong (hai điểm). */
  readonly onMeasure?: (result: PascalMeasureResult) => void;
  /** Màn di động: `view` tắt post-FX lúc đầu, bật lại khi nạp xong lần đầu. DPR đã ≤ 1,5 sẵn trong `<Viewer>`. */
  readonly lite?: boolean;
}

