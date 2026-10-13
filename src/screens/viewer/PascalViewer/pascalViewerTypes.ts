/**
 * Hợp đồng của màn xem 3D dựng bằng Pascal.
 *
 * Kiểu ở đây là **toàn bộ** thứ view cần. View không chạm store, không chạm
 * mạng, không biết Pascal tồn tại — nó nhận một `state` đã tính sẵn và vài hàm
 * gọi lại. Đó là mục D của `CLAUDE.md`, và nó là lý do bài kiểm bảy trạng thái
 * dựng được cả bảy mà không cần WebGL.
 *
 * Chỗ khó của màn này, và vì sao nó đáng có hợp đồng riêng: Pascal chạy ở
 * **gốc React thứ hai**, sau một gói dựng riêng nạp lúc chạy. `ScreenErrorBoundary`
 * của AppFront **không bắt được** lỗi xuyên gốc ấy, nên đường báo lỗi phải đi
 * ngược lên bằng một hàm gọi lại (`onFatal` của khung nhúng → `state: 'error'`
 * ở đây), chứ không phải bằng cách ném.
 */

import { formatClockTime } from '@/lib/format/datetime';
import type { PascalSaveStatus } from '@/components/pascal/pascalMountTypes';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/** Bảy trạng thái của A11, đặt tên lại cho đúng việc màn này làm. */
export type PascalViewerState = SevenState;

/** Một thứ bộ đổi dữ liệu không chuyển sang Pascal được, kèm lý do đọc được. */
export interface SkippedSummary {
  /** Loại đối tượng, tiếng Việt viết thường: `trục định vị`, `kích thước`, `ghi chú`. */
  readonly kind: string;
  /** Số lượng, đã là chuỗi — định dạng số xảy ra ở viewmodel, không ở view (A15). */
  readonly countLabel: string;
  /** Vì sao nó không sang được. Câu hoàn chỉnh, tiếng Việt. */
  readonly reason: string;
}

/**
 * Mã lỗi người dùng đọc được cho người trực.
 *
 * KHÔNG đưa `error.message` của JS ra màn hình: chuỗi ấy do thư viện sinh, luôn
 * tiếng Anh, và A6 không có cách nào thoả. Thông điệp thô đi vào telemetry;
 * thứ hiện trên màn là một trong hai mã dưới đây — chữ hoa, và A6 cho phép chữ
 * hoa cho mã lỗi.
 */
export type PascalViewerErrorCode =
  /** Không tải được gói vách ngăn từ `/assets/pascal/`. */
  | 'PASCAL-01'
  /** Gói tải được nhưng khung dựng hình chết giữa chừng. */
  | 'PASCAL-02'
  /**
   * Máy không dựng được WebGPU lẫn WebGL — không phải lỗi của bản vẽ.
   *
   * Tách riêng khỏi hai mã trên vì **đường đi tiếp khác hẳn**: PASCAL-01 và
   * -02 thì thử lại có nghĩa, còn cái này thì không — thử lại bao nhiêu lần
   * máy vẫn không có tăng tốc phần cứng. Một nút "thử lại" ở đây là một lời
   * nói dối, nên nhánh của nó không dựng nút.
   */
  | 'PASCAL-03';

/** Số đo của cảnh đang hiện, tất cả đã là chuỗi (A15). */
export interface SceneSummary {
  readonly levelLabel: string;
  readonly wallLabel: string;
  readonly openingLabel: string;
  readonly roomLabel: string;
}

export interface PascalViewerViewModel {
  readonly state: PascalViewerState;
  /** Tiêu đề màn. Luôn có, kể cả khi lỗi — màn trắng là thứ A11 tồn tại để chặn. */
  readonly title: string;
  /** Câu mô tả trạng thái hiện tại, cho người đọc và cho trình đọc màn hình. */
  readonly caption: string;
  /** Số đo cảnh; chỉ có ở `success` và `partial`. */
  readonly summary: SceneSummary | null;
  /** Thứ bị bỏ qua; chỉ có ở `partial`. */
  readonly skipped: readonly SkippedSummary[];
  /** Mã lỗi đọc được, để người dùng đọc cho người trực; chỉ có ở `error`. */
  readonly errorCode: PascalViewerErrorCode | null;
  /**
   * Trạng thái tự lưu, thành câu, cho trình đọc màn hình (A7).
   *
   * `null` khi chưa có lượt sửa nào — không có nút lưu, nên trước lượt sửa đầu
   * tiên cũng không có gì để nói.
   */
  readonly saveLabel: string | null;
}

export interface PascalViewerProps {
  readonly viewModel: PascalViewerViewModel;
  /**
   * Nơi khung Pascal cắm vào. View chỉ dựng cái hộp và đưa `ref` ra; nó không
   * biết bên trong hộp có gì.
   */
  readonly canvasRef: React.Ref<HTMLDivElement>;
  /** Thử nạp lại sau lỗi. */
  readonly onRetry: () => void;
  /** Mở lại khung xem khi đang thu gọn. */
  readonly onExpand: () => void;
  /**
   * Lối ra về màn xem 3D quen thuộc — đặt ở đầu màn, có ở mọi trạng thái, để
   * rỗng/lỗi/cờ tắt không thành ngõ cụt (BUG-487). Vắng thì không có nút.
   */
  readonly onLeave?: (() => void) | undefined;
  /** Sang màn xử lý bản vẽ — lối đi tiếp của trạng thái `empty`. Vắng thì không có nút. */
  readonly onReprocess?: (() => void) | undefined;
  /**
   * Ba bảng phụ của màn (#45). Rỗng thì cột bảng không dựng chút nào — màn
   * vẫn là một màn hoàn chỉnh, đúng như trước khi có bảng nào.
   */
  readonly panels?: readonly PascalSidePanel[] | undefined;
  /** Bảng đang mở, hoặc `null`. Loại trừ nhau theo đúng kiểu dữ liệu. */
  readonly activePanel?: PascalSidePanelId | null | undefined;
  /** Bấm một tab: mở nó, hoặc đóng nếu nó đang mở. */
  readonly onPanelChange?: ((panel: PascalSidePanelId | null) => void) | undefined;
}

/** Nhãn tiếng Việt cho từng trạng thái, viết thường kiểu câu (A6). */
export const PASCAL_VIEWER_CAPTIONS: Readonly<Record<PascalViewerState, string>> = {
  loading: 'Đang nạp khung dựng hình…',
  empty: 'Bản vẽ chưa có đối tượng nào để dựng.',
  partial: 'Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được.',
  success: 'Đã dựng xong toàn bộ bản vẽ.',
  error: 'Không nạp được khung dựng hình.',
  forbidden: 'Màn xem 3D mới chưa bật cho tài khoản này.',
  collapsed: 'Khung xem đang thu gọn để đỡ tốn máy.',
};

/**
 * Câu tiếng Việt cho từng trạng thái lưu của editor Pascal (A7).
 *
 * Không có nút lưu, nên những câu này là **cách duy nhất** người dùng biết bản
 * vẽ của mình đã tới máy chủ hay chưa.
 */
export const PASCAL_SAVE_LABELS: Readonly<Record<PascalSaveStatus, string>> = {
  idle: 'Chưa có thay đổi nào.',
  pending: 'Đang chờ lưu…',
  saving: 'Đang lưu…',
  saved: 'Đã lưu',
  paused: 'Tạm dừng lưu.',
  error: 'Chưa lưu được thay đổi.',
};

/** Câu trạng thái lưu; khi đã lưu thì kèm giờ: "Đã lưu lúc 14:32" (#24). */
export const saveLabelOf = (status: PascalSaveStatus | null, savedAt: number | null): string | null => {
  if (status === null) return null;
  if (status === 'saved' && savedAt !== null) return `${PASCAL_SAVE_LABELS.saved} lúc ${formatClockTime(savedAt)}`;
  return PASCAL_SAVE_LABELS[status];
};

/** Tiêu đề màn. Một chuỗi, để không chỗ nào tự chế ra bản khác. */
export const PASCAL_VIEWER_TITLE = 'Mô hình 3D';

/** Nút lối ra ở đầu màn, về `/3d`. */
export const PASCAL_LEAVE_LABEL = 'Về màn xem 3D';

/** Hành động của trạng thái rỗng, sang màn xử lý bản vẽ. */
export const PASCAL_REPROCESS_LABEL = 'Xử lý lại bản vẽ';

/* -------------------------------------------------------------------------- */
/* Ba bảng phụ của màn (#45, #36).                                             */
/* -------------------------------------------------------------------------- */

/**
 * Bảng phụ nào đang mở. Đúng một, hoặc không cái nào (#45 — loại trừ nhau).
 *
 * Ba bảng này là **giao diện AppFront**, không phải 3D, nên chúng ở lại cây
 * React của AppFront chứ không đi qua `extraSidebarPanels` của `<Editor>`:
 * gốc React thứ hai của Pascal có bản `react` riêng, và một component
 * AppFront dựng bằng `react` của gói chính mà render bằng `react-dom` của
 * gói Pascal là hai bộ hook chồng nhau — lỗi lúc chạy, không phải lúc dịch.
 * Cột nằm cạnh khung dựng, cùng hàng, nên vẫn là một màn.
 */
export type PascalSidePanelId = 'rooms' | 'history' | 'furniture';

/** Một bảng phụ: cái tab, và thứ nó mở ra. */
export interface PascalSidePanel {
  readonly id: PascalSidePanelId;
  /** Nhãn tab, tiếng Việt kiểu câu (A6). */
  readonly label: string;
  /** Nội dung bảng. Chỉ dựng khi bảng đang mở. */
  readonly render: () => React.ReactNode;
}

/** Nhãn tab của ba bảng, một chỗ để không bản nào lệch bản nào. */
export const PASCAL_SIDE_PANEL_LABELS: Readonly<Record<PascalSidePanelId, string>> = {
  rooms: 'Diện tích phòng',
  history: 'Lịch sử thao tác',
  furniture: 'Thư viện đồ đạc',
};

/** Bề ngang cột bảng phụ — 344 px, cùng số màn cũ dùng (#45). */
export const PASCAL_SIDE_PANEL_WIDTH_PX = 344;

/** Nhãn vùng chứa các tab, cho trình đọc màn hình. */
export const PASCAL_SIDE_PANEL_RAIL_LABEL = 'Bảng phụ';

/** Câu toast cho hai chiều của lịch sử, tiếng Việt kiểu câu (A6, A8). */
export const PASCAL_HISTORY_TOASTS = {
  undo: {
    title: 'Đã hoàn tác thay đổi gần nhất',
    description: 'Bản vẽ đã lùi một bước và đang được lưu lại.',
  },
  redo: {
    title: 'Đã làm lại thay đổi vừa hoàn tác',
    description: 'Bản vẽ đã tiến lại một bước và đang được lưu lại.',
  },
} as const;
