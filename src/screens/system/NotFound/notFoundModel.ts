/**
 * Hình dạng dữ liệu của màn "không tìm thấy trang" — nguồn sự thật của cả màn.
 *
 * ## Vì sao có file này
 *
 * Màn này dựng bởi bốn lượt song song (hook+cổng, view+hình vẽ, test+story,
 * i18n+route). Mỗi lượt tự khai hình dạng của mình thì bốn bản lệch nhau đúng
 * vào lúc ghép, và người ghép phải viết lại một trong bốn. File này đông lạnh
 * hình dạng trước khi lượt nào bắt đầu — cùng vai trò `notificationModel.ts`
 * giữ cho trung tâm thông báo.
 *
 * ## Bốn chỗ đặc tả nói một đằng, repo có một nẻo
 *
 * Đã khảo sát bằng bốn lượt đọc (ghi chú đầy đủ ngoài repo) TRƯỚC khi viết dòng
 * này. Bốn khoản dưới đây là kết luận đã chốt, không phải phỏng đoán — worker
 * KHÔNG được tự sửa lại, và cũng không cần mở lại các file ấy để kiểm.
 *
 * 1. **"D-01 truy vấn danh sách dự án gần đây" — không tồn tại.** `src/lib/query`
 *    không có fetcher nào cho dự án, chỉ có `queryKeys`. Nguồn dữ liệu duy nhất
 *    là `ProjectDashboard/projectsGateway.ts`, nằm trong thư mục của MÀN KHÁC.
 *    Màn này KHÔNG nhập chéo màn: nó có cổng riêng {@link NotFoundGateway}, và
 *    cắm vào `queryKeys.project.list()` + `cachePolicy` theo R-64.
 *
 * 2. **"P-02 thời điểm mở gần nhất" — dữ liệu chỉ có thời điểm CẬP NHẬT.**
 *    `DashboardProject.updatedAgoMs` là "sửa lần cuối cách đây bao lâu", không
 *    phải "mở lần cuối"; không có trường nào ghi lượt mở. Nhãn vì thế nói
 *    "cập nhật", không nói "mở". Dán nhãn "mở gần nhất" lên dữ liệu cập nhật là
 *    nói sai với người dùng, và người dùng không có cách nào biết mình bị nói sai.
 *
 * 3. **"O-01 ghi đường dẫn bị lỗi" — telemetry KHÔNG chở được đường dẫn.**
 *    `screen.error` có đúng bốn trường (`screenCode`, `errorKind`, `severity`,
 *    `retryable`); chú thích của nó nói thẳng là không có trường thông điệp và
 *    không có stack, cố ý. Không sự kiện nào trong 12 sự kiện nhận chuỗi tự do —
 *    `codeSchema` ép `/^[a-z0-9][a-z0-9._-]*$/`, tối đa 48 ký tự. Nên màn phát
 *    `screen.error` với `screenCode` = {@link NOT_FOUND_SCREEN_CODE} và KHÔNG
 *    kèm đường dẫn. Đường dẫn vẫn hiện trên màn cho người dùng gửi hỗ trợ
 *    ({@link NotFoundVm.errorCaption}) — chỗ nó mất là đường về đội sản phẩm.
 *    Thiếu sót này BÁO CÁO thành prompt logic (R-69), không vá bằng cách sửa
 *    `src/lib/telemetry` — R-68 khoá thư mục đó.
 *
 * 4. **"Nói rõ mục bị xoá khi nào và bởi ai, có khôi phục từ thùng rác được
 *    không" — không có năng lực nào biết điều đó.** Không có endpoint xoá/thùng
 *    rác/khôi phục dự án trong `src/api/endpoints.ts`, không có query nào trong
 *    `src/lib/query` (`restoreVersion` là phiên bản của TẦNG, việc khác hẳn).
 *    Nên màn KHÔNG có nhánh ấy: không cổng giả, không dữ liệu bịa, không TODO.
 *    Trạng thái `partial` mang nghĩa còn lại và có thật — gợi ý đã về nhưng chưa
 *    đủ bộ. Năng lực "thùng rác" BÁO CÁO thành prompt logic (R-69).
 *
 * ## S-44 và S-45 chưa tồn tại
 *
 * Đặc tả bảo "chuyển sang cách xử lý của S-44 (không có quyền) / S-45 (mất
 * mạng)". Không có màn nào như vậy trong `src/screens/**`. Không điều hướng tới
 * màn không tồn tại, và dựng chúng nằm ngoài phạm vi bàn giao. Cả hai xử lý
 * NGAY TRONG màn này: {@link NotFoundReason} phân biệt ba nguyên nhân, và
 * `forbidden` của A11 chính là nhánh "không có quyền".
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/**
 * Vì sao người dùng tới đây. Quyết định màn NÓI GÌ, không chỉ nói bằng giọng nào.
 *
 * Đoán sai giữa `offline` và `missing` tệ hơn là không nói gì: bảo một người
 * đang mất mạng rằng trang của họ "đã bị xoá hoặc đã chuyển đi" là một câu sai
 * khiến họ bỏ cuộc thay vì bật lại wifi. Nên `offline` chỉ được đặt khi có bằng
 * chứng thật (cổng ném đúng lỗi mạng), không bao giờ suy đoán từ việc đọc hỏng.
 */
export const NOT_FOUND_REASONS = ['missing', 'forbidden', 'offline'] as const;

export type NotFoundReason = (typeof NOT_FOUND_REASONS)[number];

/**
 * Một dự án gần đây, đã dựng xong mọi chữ (A15).
 *
 * `recencyLabel` là chuỗi hoàn chỉnh dựng bằng `formatTimestamp` ở tầng hook —
 * view chỉ in ra. Nó nói "cập nhật ..." chứ không nói "mở ...", vì khoản 2 trên.
 */
export interface RecentProjectVm {
  readonly id: string;
  readonly name: string;
  /** Đường dẫn đã dựng sẵn từ `ROUTES.project.floors(id)` (R-65). */
  readonly to: string;
  /** Chuỗi đã dựng xong, hiện khi trỏ vào hàng. Ví dụ: "cập nhật 2 giờ trước". */
  readonly recencyLabel: string;
}

/** Trạng thái màn — dùng lại đúng bảy tên của A11. */
export type NotFoundScreenState = SevenState;

/**
 * Cổng dữ liệu của màn. Cửa DUY NHẤT ra tầng ngoài.
 *
 * Đúng MỘT phép. Đặc tả gợi ý một phép thứ hai (chuyện đã biết về mục bị xoá)
 * nhưng không tầng nào trong repo biết chuyện đó — xem khoản 4 ở đầu file. Một
 * cổng hai phép mà phép thứ hai luôn trả rỗng là cách để màn trông như đã nối
 * xong trong khi chưa.
 *
 * Ném lỗi khi hỏng; tầng trên bắt và vẽ `error`. Không nuốt lỗi ở đây — nuốt
 * lỗi là cách trạng thái 4 biến mất mà không ai để ý.
 */
export interface NotFoundGateway {
  /** Tối đa {@link RECENT_PROJECT_LIMIT} dự án, đã sắp theo độ mới. */
  readonly listRecentProjects: () => Promise<readonly RecentProjectVm[]>;
}

/** Một nút. `onActivate` đã nối sẵn; view không biết nó đi đâu. */
export interface NotFoundAction {
  readonly label: string;
  readonly onActivate: () => void;
}

/**
 * Thứ view nhận. View thuần: không store, không mạng, test được chỉ từ props (mục D).
 *
 * Mọi chuỗi ở đây đã là tiếng Việt hoàn chỉnh, mọi con số đã thành chữ. View
 * không định dạng gì thêm (A15) và không tự quyết nói gì.
 */
export interface NotFoundVm {
  readonly state: NotFoundScreenState;
  readonly reason: NotFoundReason;
  /** Tiêu đề h2. Đổi theo {@link NotFoundVm.reason}. */
  readonly title: string;
  /** Một câu giải thích, tiếng thường, viết thường kiểu câu (A6). */
  readonly description: string;
  /** Caption chân trang, chọn được để gửi hỗ trợ. Ví dụ: "Mã lỗi: 404 · /du-an/8f2a". */
  readonly errorCaption: string;
  /** Nút chính. Nhãn đổi thành "Đăng nhập" khi chưa đăng nhập. */
  readonly primaryAction: NotFoundAction;
  /** Nút chìm "Quay lại". */
  readonly secondaryAction: NotFoundAction;
  /** Tối đa {@link RECENT_PROJECT_LIMIT} hàng. Rỗng ở trạng thái `empty`. */
  readonly recentProjects: readonly RecentProjectVm[];
  /** Tiêu đề khối gợi ý. Ẩn cả khối khi `recentProjects` rỗng. */
  readonly recentHeading: string;
  /** `true` ở `collapsed`: bỏ hình minh hoạ, thu khoảng cách. */
  readonly isCompact: boolean;
  /** `true` khi người dùng đã bật giảm chuyển động — hình vẽ hiện đủ luôn. */
  readonly prefersReducedMotion: boolean;
}

/** Tối đa ba hàng. Đặc tả nói ba, và ba có tên đúng một chỗ (R-71). */
export const RECENT_PROJECT_LIMIT = 3;

/**
 * `screenCode` của màn, cho `screen.error` (O-01).
 *
 * Phải khớp `TELEMETRY_CODE_PATTERN` `/^[a-z0-9][a-z0-9._-]*$/` và ngắn hơn 48
 * ký tự — nên nó là hằng ở đây, một lần, chứ không phải chuỗi gõ tay chỗ phát.
 */
export const NOT_FOUND_SCREEN_CODE = 'system.not-found';

/** Mã lỗi hiện trong caption. Không bao giờ là chữ số khổng lồ giữa màn. */
export const NOT_FOUND_ERROR_CODE = '404';

/** Bề rộng cột nội dung (px). Đặc tả: một cột 560 căn giữa cả ngang lẫn dọc. */
export const CONTENT_COLUMN_PX = 560;

/** Cạnh ô vuông hình minh hoạ (px). Đặc tả: hình nét 120. */
export const ILLUSTRATION_SIZE_PX = 120;

/** Độ dày nét hình minh hoạ. Cùng con số `EmptyState` đặt cho icon của nó. */
export const ILLUSTRATION_STROKE_WIDTH = 1.5;

/** Nội dung nâng lên bao nhiêu px khi hiện ra. Đặc tả: nâng 8px trong 340ms. */
export const CONTENT_LIFT_PX = 8;

/** Hàng dự án nâng bao nhiêu px khi trỏ vào. Đặc tả: nâng 1px. */
export const ROW_HOVER_LIFT_PX = 1;
