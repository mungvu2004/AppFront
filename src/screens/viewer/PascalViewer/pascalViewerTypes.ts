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

/** Tiêu đề màn. Một chuỗi, để không chỗ nào tự chế ra bản khác. */
export const PASCAL_VIEWER_TITLE = 'Mô hình 3d';
