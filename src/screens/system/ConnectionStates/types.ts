/**
 * S-45 — hợp đồng công khai của lớp trạng thái kết nối.
 *
 * Đây không phải một trang: nó là **lớp dùng chung** của mọi màn, nên nó không
 * có route (bảng 0.8 ghi "không route") và nó được nhúng vào vỏ ứng dụng.
 *
 * ## Luật tuyệt đối của màn này
 *
 * Mất kết nối hay hết phiên **không bao giờ được làm mất việc của người dùng**.
 * Hàng đợi là của T-09 (`lib/offline/queueStore`), việc phát lại là của T-10
 * (`lib/offline/replayer`). Màn chỉ ĐỌC hai thứ đó và nói ra; nó không tự giữ
 * hàng đợi, không tự viết cơ chế phát lại, không tự đặt giãn cách thử lại.
 *
 * ## Ba tầng hiển thị, và vì sao chúng là MỘT trường chứ không ba cờ
 *
 * Đặc tả nói mức độ ồn ào phải tương ứng mức độ nghiêm trọng, và ba tầng
 * "không được trộn". Ba cờ boolean thì trộn được — và sẽ trộn, vào đúng lúc
 * mạng chập chờn giữa lúc phiên sắp hết. Nên ở đây chỉ có **một**
 * {@link ConnectionCase}, và {@link ConnectionTier} suy ra từ nó. Hai thứ không
 * thể cùng hiện vì chúng là cùng một biến.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/**
 * Chuyện đang xảy ra với kết nối. Đúng một giá trị tại một thời điểm.
 *
 * - `online` — không có gì để nói.
 * - `degraded` — máy vẫn báo có mạng nhưng máy chủ không trả lời kịp. Đây là
 *   "mạng chậm" của đặc tả, và nó **đo được**: `browserOnline && !pingOnline`,
 *   đúng phép phân biệt mà `screens/system/MobileViewer/mobileViewerGateway.ts`
 *   đã đặt ra (`isNetworkDegraded`).
 * - `offline` — mất mạng và có lệnh đang chờ.
 * - `syncing` — đang phát lại hàng đợi.
 * - `synced` — vừa phát lại xong; thông báo rồi tự ẩn.
 * - `queueFull` — hàng đợi chạm trần 200 lệnh hoặc 5 MB của T-09.
 * - `sessionExpired` — phiên hết hạn trong khi còn việc chưa lưu.
 */
export type ConnectionCase =
  | 'online'
  | 'degraded'
  | 'offline'
  | 'syncing'
  | 'synced'
  | 'queueFull'
  | 'sessionExpired';

/**
 * Mức ồn ào được phép, suy ra từ {@link ConnectionCase}.
 *
 * - `none` — không vẽ gì.
 * - `statusBar` — một chấm và một nhãn ngắn ở thanh trạng thái.
 * - `band` — dải mỏng cao 32 dính dưới thanh trên.
 * - `blocking` — tấm giữa màn. **Chỉ** phiên hết hạn mới lên tới đây, vì chỉ
 *   lúc đó mới thật sự không lưu được nữa.
 */
export type ConnectionTier = 'none' | 'statusBar' | 'band' | 'blocking';

/** Một lệnh đang nằm trong hàng đợi, đã dựng thành chữ cho người đọc. */
export interface PendingCommandRow {
  readonly id: string;
  /** Tên việc, viết thường kiểu câu (A6). */
  readonly label: string;
  /** "14:32" — dựng bằng `lib/format/datetime`. */
  readonly createdAtLabel: string;
  /** "1,2 KB" — dựng bằng `lib/format/bytes`. */
  readonly sizeLabel: string;
}

/** Toàn bộ thứ view cần để vẽ. */
export interface ConnectionStatesModel {
  readonly state: SevenState;
  readonly connectionCase: ConnectionCase;
  readonly tier: ConnectionTier;
  /** Một câu, đúng một câu. Đặc tả: mỗi trường hợp "một câu và một hành động". */
  readonly headline: string;
  /** Nhãn của hành động duy nhất; `null` khi trường hợp này không có hành động nào. */
  readonly actionLabel: string | null;
  readonly pendingCount: number;
  /** "12 thay đổi chờ đồng bộ". */
  readonly pendingLabel: string;
  /** "Đã đồng bộ xong lúc 14:32", hoặc `null` khi chưa lần nào. */
  readonly lastSyncLabel: string | null;
  /** "8/12" khi đang phát lại, `null` khi không. */
  readonly replayLabel: string | null;
  /** Lệnh bị bỏ vì phát lại hỏng — D-09 gọi rõ tên chúng, không giấu. */
  readonly droppedCount: number;
  readonly droppedLabel: string | null;
  readonly isDetailOpen: boolean;
  readonly pendingRows: readonly PendingCommandRow[];
  /** Trạng thái 7 — dải rút thành một biểu tượng ở thanh trạng thái. */
  readonly isCollapsed: boolean;
  readonly errorMessage: string | null;
  readonly forbiddenMessage: string | null;
}

/** Mọi thứ người dùng bấm được. */
export interface ConnectionStatesActions {
  readonly onOpenDetail: () => void;
  readonly onCloseDetail: () => void;
  /** Phát lại ngay — gọi thẳng `replayer.replayNow()`, màn không tự thử lại. */
  readonly onReplayNow: () => void;
  /** Đăng nhập lại. Chỉ có ở trường hợp phiên hết hạn. */
  readonly onSignInAgain: (() => void) | null;
}

export interface ConnectionStatesProps {
  readonly model: ConnectionStatesModel;
  readonly actions: ConnectionStatesActions;
}

/** Props của lớp đã nối — R-73: một thẻ là đủ. */
export interface ConnectionStatesContainerProps {
  readonly projectId: string;
  /** Đường đưa người dùng về màn đăng nhập; vắng thì tấm giữa màn không có nút. */
  readonly onSignInAgain?: () => void;
}

export type { SevenState };
