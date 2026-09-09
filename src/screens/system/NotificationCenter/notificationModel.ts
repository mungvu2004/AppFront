/**
 * Hình dạng dữ liệu của trung tâm thông báo — nguồn sự thật của cả màn.
 *
 * ## Vì sao có file này thay vì để mỗi nơi tự khai
 *
 * Màn này được dựng bởi bốn lượt song song (hook, view, test, i18n/route). Nếu
 * mỗi lượt tự khai hình dạng của mình thì bốn bản sẽ lệch nhau đúng vào lúc
 * ghép lại, và người ghép phải viết lại một trong bốn. File này đông lạnh hình
 * dạng đó trước khi lượt nào bắt đầu — cùng vai trò mà `accountDraft.ts` giữ cho
 * màn cài đặt tài khoản.
 *
 * ## Vì sao đây là viewmodel chứ không phải kiểu dữ liệu máy chủ
 *
 * A15: định dạng số và thời gian xảy ra ở viewmodel, không ở view. Nên
 * `relativeTime` là chuỗi đã dựng xong ("12 phút trước") chứ không phải một mốc
 * thời gian để view tự tính, và `unreadBadge` là "9+" chứ không phải phép cắt
 * ngưỡng nằm trong JSX. View chỉ in ra.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/**
 * Bốn loại thông báo, lấy đúng mã của ma trận cài đặt tài khoản (S-05,
 * `useAccountTables.ts:115-141`) để hai nơi không đặt tên khác nhau cho cùng
 * một sự việc.
 *
 * Ma trận đó có **năm** dòng; `morningDigest` cố ý không có mặt ở đây. Cấm tuyệt
 * đối của màn này là "mọi thông báo phải dẫn tới một đối tượng cụ thể", mà bản
 * tổng hợp mỗi sáng gộp nhiều việc nên không có đối tượng nào để dẫn tới. Nó là
 * thư điện tử theo mặc định của chính ma trận ấy (`email: true, inApp: false`),
 * và nó ở lại bên đó.
 */
export const NOTIFICATION_KINDS = ['aiCompleted', 'violationFound', 'projectInvite', 'commentMention'] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * Đích cụ thể mà một thông báo dẫn tới.
 *
 * `to` phải dựng từ hằng trong `@/routes/paths` — R-65 cấm chuỗi bắt đầu bằng
 * `/` trong `src/screens/**`, và một đường dẫn viết tay là loại lỗi chỉ lộ ra ở
 * môi trường khác với môi trường bạn thử.
 */
export interface NotificationTarget {
  readonly projectId: string;
  readonly projectName: string;
  readonly floorId?: string | undefined;
  /** Chữ hiển thị của liên kết nằm trong câu. */
  readonly label: string;
  /** Đường dẫn đã dựng sẵn từ `ROUTES`. */
  readonly to: string;
}

export interface NotificationInlineAction {
  /** Nhãn tiếng Việt viết thường kiểu câu (A6): "xem kết quả", "xem lời mời". */
  readonly label: string;
  /**
   * `'accept'` là Ô CHỜ, hôm nay KHÔNG nguồn nào sinh ra nó.
   *
   * Tầng logic không có phép nhận lời mời: `src/api/client.ts` có `invite()` và
   * `resendInvite()` — hai lời gọi của màn quản trị S-06 — nhưng không có
   * `acceptInvite` ở bất cứ đâu trong `src/api`, `src/lib`, `src/domain` hay
   * `src/store`, và cổng ở cuối file này cố ý không mọc thêm một phép ghi thành
   * viên mà không tầng nào khác biết tới.
   *
   * Nên mục lời mời trong cổng mang `'navigate'` với nhãn "xem lời mời", nói
   * đúng việc nó làm. Khi T-09 nối dây thật, ĐÂY là chỗ nạp vào: thêm phép ghi
   * vào {@link NotificationCenterGateway}, rồi đổi mục ấy sang `'accept'`.
   */
  readonly kind: 'navigate' | 'accept';
}

/** Một mục trong danh sách. Mọi định dạng đã xong trước khi tới view (A15). */
export interface NotificationItemVm {
  readonly id: string;
  readonly kind: NotificationKind;
  /** Một CÂU tiếng Việt, không phải mã. Có tên dự án và tên đối tượng. */
  readonly sentence: string;
  readonly target: NotificationTarget;
  /** epoch ms — hook dùng để gộp theo ngày; view không được tự định dạng nó. */
  readonly createdAt: number;
  /** Đã dựng bằng `formatTimestamp` (P-02). View chỉ in ra. */
  readonly relativeTime: string;
  readonly isRead: boolean;
  /** Chỉ `commentMention`: trích đoạn bình luận, view cắt tối đa hai dòng. */
  readonly excerpt?: string | undefined;
  readonly inlineAction?: NotificationInlineAction | undefined;
}

/** Nhóm theo ngày (P-03). `heading` đã là câu tiếng Việt. */
export interface NotificationDayGroup {
  /** Khoá ổn định cho React, dẫn xuất từ ngày chứ không phải chỉ số mảng. */
  readonly key: string;
  readonly heading: string;
  readonly items: readonly NotificationItemVm[];
}

export const NOTIFICATION_FILTERS = ['all', 'unread', 'mentions'] as const;

export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

/** Nhãn của bộ lọc — ở đây chứ không ở JSX, để `vi.json` và view không lệch. */
export const NOTIFICATION_FILTER_LABELS: Readonly<Record<NotificationFilter, string>> = Object.freeze({
  all: 'Tất cả',
  mentions: 'Nhắc đến tôi',
  unread: 'Chưa đọc',
});

/**
 * Ngưỡng của huy hiệu chuông. Trên ngưỡng thì hiện "9+".
 *
 * R-71 cấm hằng viết tay trong màn, và repo không có hàm cắt ngưỡng dùng chung
 * (`format/number.ts` không có; `components/ui/Tabs.tsx:151` tự viết "99+" tại
 * chỗ — đó là ca đi trước, không phải khuôn để chép). Nên nó có tên ở đây, một
 * lần, và cả hook lẫn test đọc cùng con số này.
 */
export const UNREAD_BADGE_CAP = 9;

/** Độ trễ so le khi các chấm mờ đi lúc đánh dấu tất cả đã đọc. */
export const UNREAD_DOT_STAGGER_MS = 24;

/** Đường kính chấm "chưa đọc", tính bằng px. Chấm — không bao giờ là nền hàng. */
export const UNREAD_DOT_SIZE_PX = 6;

/** Góc nghiêng của chuông khi có thông báo tới, tính bằng độ. Đúng một lần. */
export const BELL_NUDGE_DEGREES = 8;

/**
 * Cổng dữ liệu của trung tâm thông báo.
 *
 * ## Vì sao đây là bộ nhớ trong chứ không phải một lời gọi mạng
 *
 * `src/api/endpoints.ts` không có nhóm `notifications`; `src/api/client.ts` không
 * có thực thể thông báo; `queryKeys` không có nhánh `notification`; và
 * `WRITE_OPERATIONS` không có phép ghi nào liên quan. `src/api/**` và
 * `src/lib/**` là những thư mục màn này không được sửa (R-68). Bịa một đường dẫn
 * ra rồi gọi vào đó cho "trông như thật" là cách chắc chắn nhất để màn hình xanh
 * trên máy người viết và đỏ ở mọi nơi khác.
 *
 * Nên dữ liệu được giữ trong bộ nhớ của chính module cổng, đúng khuôn mà
 * `screens/account/AccountSettings/accountSettingsGateway.ts` (nợ T-08) và
 * `screens/pipeline/ProcessingScreen/processingGateway.ts` đã đi trước. Đó là
 * một khoản nợ đã ghi, không phải một lời hứa đã giữ.
 *
 * ## Vì sao `subscribe` nhận nguồn từ ngoài chứ không tự mở kết nối
 *
 * Đặc tả nói thông báo mới đến qua kênh của T-06 và cấm màn tự mở SSE riêng.
 * Nhưng `createEventChannel` (`lib/realtime/eventChannel.ts:18-21`) khoá cứng
 * `ChannelEvent = { type: 'progress'; data: Progress }` và phân tích gói tin bằng
 * `ProgressSchema.strict` — nó **không** chở được một thông báo.
 * `createProgressStream` tuy generic ở `TPatch` nhưng vẫn tự mở `EventSource`
 * riêng, tức đúng thứ bị cấm, và cũng không có điểm cuối nào để mở tới.
 *
 * Nên màn không mở kết nối nào cả: nó **nhận** nguồn từ bên ngoài. Hôm nay nguồn
 * đó là bộ nhớ của cổng này; khi T-09 nối dây thật (thêm nhóm `notifications` vào
 * `ENDPOINTS`, nhánh `queryKeys.notification`, và một kênh thời gian thực chở
 * được gói tin không-phải-Progress), chữ ký dưới đây không đổi và đây là file
 * duy nhất phải sửa.
 */
export interface NotificationCenterGateway {
  /** Đọc danh sách. Ném lỗi khi hỏng — tầng trên bắt và vẽ trạng thái 4. */
  readonly list: () => Promise<readonly NotificationItemVm[]>;
  /** Đánh dấu đã đọc. Gọi khi người dùng làm việc đó, không bao giờ tự động. */
  readonly markRead: (ids: readonly string[]) => Promise<void>;
  readonly markAllRead: () => Promise<void>;
  /**
   * Đăng ký nhận thông báo mới tới. Trả về hàm huỷ đăng ký.
   *
   * Đây là cửa duy nhất thông báo mới đi vào màn. Không có `new EventSource`,
   * không có `fetch`, không có hẹn giờ hỏi lại ở bất kỳ đâu trong thư mục màn.
   */
  readonly subscribe: (listener: (arrived: NotificationItemVm) => void) => () => void;
}

/** Trạng thái màn, dùng lại đúng bảy tên của A11 (khuôn `useEditorTour.ts:107`). */
export type NotificationScreenState = SevenState;
