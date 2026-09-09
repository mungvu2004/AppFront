/**
 * Hợp đồng kiểu của lớp phủ cộng tác — nguồn sự thật DUY NHẤT cho cả bốn worker.
 *
 * File này được điều phối viên chốt ở cổng hợp đồng và **không worker nào được
 * sửa**. Cần đổi một trường thì escalate, đừng sửa tại chỗ: bốn nhánh song song
 * cùng sửa một kiểu là cách chắc chắn nhất để lớp gộp phải viết lại từ đầu.
 *
 * ## Ba năng lực, và vì sao hai trong ba đang tắt
 *
 * Đặc tả liệt kê S-11 (`src/store/syncChannel.ts`) và D-01/D-04 (bình luận) vào
 * mục "logic đã có — chỉ gọi lại". Khảo sát bốn worker lớp một xác nhận **cả hai
 * đều không tồn tại**: không state, không endpoint, không schema, không query.
 * `src/lib/realtime/eventChannel.ts` có thật và dùng được, nhưng nó cần một URL
 * mà `src/api/endpoints.ts` không có nhóm nào cung cấp — và R-65 cấm viết thẳng
 * chuỗi đường dẫn trong `src/screens/**`, R-69 cấm stub. Nghĩa là không có đường
 * hợp pháp nào để mở kết nối, chứ không phải chưa ai chịu viết.
 *
 * Nên `capabilities` là một cổng thật, không phải cờ trang trí:
 *
 * - `comments === false` → ghim, bóng 320 và danh sách bình luận **rời khỏi DOM**.
 *   Không `disabled`, không ẩn bằng CSS, không tooltip "sắp có" — thứ không có
 *   logic đỡ phía sau thì không được để lại dấu vết nào trên màn.
 * - `presence === false` → nhóm ảnh chỉ còn bạn, đúng trạng thái 1 mà đặc tả đã
 *   định nghĩa ("rỗng — chỉ mình đang xem"), kèm caption thường trực của trạng
 *   thái 3/4. Đây không phải lỗi; đây là trạng thái hợp lệ.
 *
 * Bảy trạng thái vẫn kiểm được đủ vì story và test **tiêm props** — cách mọi màn
 * trong repo vẫn làm, không phải bịa dữ liệu.
 *
 * D-09 thì ngược lại: `src/lib/versioning/conflict.ts` **có thật**, nên panel xung
 * đột là phần chạy được thật, và nó phải gọi `resolveConflict`, không tự xử.
 */

import type { EntityKind, FieldConflict } from '@/lib/versioning/mergeStrategies';

/**
 * Năng lực nào đang có đường dây thật phía sau.
 *
 * Cổng đọc ra giá trị này; view chỉ đọc nó để quyết định *có dựng* nhánh đó
 * không. Không nhánh nào được suy ngược: `presence === false` mà vẫn vẽ con trỏ
 * bằng dữ liệu rỗng là đúng thứ luật này sinh ra để chặn.
 */
export interface CollaborationCapabilities {
  /** Hiện diện: ai đang xem, con trỏ ở đâu. Cần S-11 — hiện chưa có. */
  readonly presence: boolean;
  /** Bình luận: ghim, chuỗi trả lời, nhắc tên. Cần D-01/D-04 — hiện chưa có. */
  readonly comments: boolean;
  /** Khoá đối tượng: ai đang giữ gì. Cần S-11 — hiện chưa có. */
  readonly locks: boolean;
  /** Xin quyền chỉnh sửa. Cần S-11 để chuyển giao khoá — hiện chưa có. */
  readonly requestAccess: boolean;
}

/**
 * Trạng thái kênh, đặt tên theo `ChannelStatus` của `lib/realtime/eventChannel.ts`
 * để hai bên không lệch từ vựng, cộng hai giá trị mà đặc tả tách riêng.
 *
 * Ánh xạ sang bảy trạng thái A11:
 * `dang-noi` → 2 (đang tải, caption nhẹ, **không vòng xoay**) ·
 * `dong-bo-cham` → 3 (một phần) · `lam-viec-rieng` → 3 (mất đồng bộ, **vẫn sửa
 * được**) · `mat-ket-noi` → 4 (lỗi, sửa tiếp tại chỗ) · `da-noi` → 5 (xong).
 */
export type CollaborationSyncState =
  | 'dang-noi'
  | 'da-noi'
  | 'dong-bo-cham'
  | 'lam-viec-rieng'
  | 'mat-ket-noi';

/** Một người đang xem. `isSelf` để nhóm ảnh biết ai là bạn mà không phải so id. */
export interface CollaboratorVm {
  readonly id: string;
  readonly name: string;
  /** Chữ cái tắt đã dựng sẵn — `Avatar` không tự cắt tên tiếng Việt có dấu. */
  readonly initials: string;
  /** "đang ở tầng nào" — nhãn đã dựng, không phải số tầng thô (A15). */
  readonly floorLabel: string;
  /** "đang chọn gì"; `null` khi họ không chọn gì. */
  readonly selectionLabel: string | null;
  /** Toạ độ con trỏ trong hệ của canvas; `null` khi không có. */
  readonly cursor: { readonly x: number; readonly y: number } | null;
  readonly isSelf: boolean;
}

/**
 * Một đối tượng đang bị người khác giữ.
 *
 * `heldSinceLabel` là **chuỗi đã định dạng** bằng `formatTimestamp` (P-02) ở
 * viewmodel, không phải mốc thời gian thô: A15 nói định dạng số xảy ra ở
 * viewmodel chứ không ở view.
 */
export interface LockVm {
  readonly objectId: string;
  readonly holderName: string;
  readonly heldSinceLabel: string;
}

/** Một bên của xung đột: giá trị, ai đổi, lúc nào — cả ba đều đã thành chuỗi. */
export interface ConflictSideVm {
  readonly valueLabel: string;
  readonly authorName: string;
  readonly atLabel: string;
}

/**
 * Một xung đột đang chờ người quyết.
 *
 * Dựng từ `FieldConflict` của `lib/versioning/mergeStrategies`, và đây là chỗ có
 * một cái bẫy đã suýt lọt: `FieldConflict` mang tác giả và thời điểm cho **phía
 * họ** (`remoteChange.changedBy` / `.changedAt`) nhưng phía mình chỉ có
 * `localValue` — không tác giả, không thời điểm. Đặc tả lại bắt hiện **cả hai**
 * tác giả kèm thời điểm. Nên phía mình lấy từ nơi khác, hợp pháp và có thật:
 * tên từ `getSession().user` (`lib/auth`), thời điểm do hook ghi lại lúc sửa
 * cục bộ. Không bên nào được để trống.
 */
export interface ConflictVm {
  readonly entityId: string;
  readonly entityType: EntityKind;
  /** Tên thuộc tính, đã sang nhãn người đọc được. */
  readonly fieldLabel: string;
  readonly mine: ConflictSideVm;
  readonly theirs: ConflictSideVm;
}

/** Ba lựa chọn của con người. Không có lựa chọn thứ tư, và không có mặc định. */
export type ConflictChoice = 'mine' | 'theirs' | 'manual';

/** Một ghim bình luận trên canvas hoặc trong 3D. */
export interface CommentPinVm {
  readonly id: string;
  readonly objectId: string;
  readonly at: { readonly x: number; readonly y: number };
  readonly isResolved: boolean;
  readonly replyCount: number;
}

/**
 * Props của view thuần.
 *
 * View **không** chạm `@/api`, `@/store`, `@/domain`, `@/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Mọi thứ dưới đây do `useCollaborationLayer`
 * dựng và container truyền xuống.
 */
export interface CollaborationLayerProps {
  readonly capabilities: CollaborationCapabilities;
  readonly syncState: CollaborationSyncState;
  readonly collaborators: readonly CollaboratorVm[];
  readonly locks: readonly LockVm[];
  /** `null` khi không có xung đột — panel 400 không dựng. */
  readonly conflict: ConflictVm | null;
  readonly comments: readonly CommentPinVm[];
  /** Trạng thái 7: ẩn con trỏ người khác, **giữ ghim bình luận**. */
  readonly isCollapsed: boolean;
  /** `false` = trạng thái 6: xem bình luận, không viết. */
  readonly canWrite: boolean;
  readonly onGoToCollaborator: (collaboratorId: string) => void;
  readonly onRequestEditAccess: (objectId: string) => void;
  readonly onResolveConflict: (choice: ConflictChoice) => void;
  /** Panel xung đột hoãn lại được — và **không bao giờ là hộp thoại**. */
  readonly onDeferConflict: () => void;
  readonly onFrameComment: (commentId: string) => void;
}

/** Cổng dữ liệu. Hook gọi cổng; view không biết cổng tồn tại. */
export interface CollaborationGateway {
  readonly capabilities: CollaborationCapabilities;
  /** Dựng `ConflictVm` từ `FieldConflict` thật — không tự giải quyết xung đột. */
  toConflictVm(conflict: FieldConflict, localChangedAtIso: string): ConflictVm;
}
