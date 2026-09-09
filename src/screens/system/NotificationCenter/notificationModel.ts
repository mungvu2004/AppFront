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

import type { NotificationKind } from '@/api/schemas/notifications';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/**
 * Bốn loại thông báo — MỘT bản, giữ ở `src/api/schemas/notifications.ts`.
 *
 * Trước lượt nối dây có hai bản: một ở đây và một ở tầng API, gõ tay giống
 * nhau. Đó đúng là thứ R-71 cấm — hai nguồn cho một quyết định, lệch nhau đúng
 * vào lúc loại thứ năm được thêm. Bản của tầng API thắng vì nó là bên đọc gói
 * tin thật (`NotificationSchema` dùng chính mảng ấy làm `z.enum`), và mục 0.4
 * cho màn nhập xuống chứ không cho API nhập ngược lên.
 *
 * Xuất lại qua đây thay vì bắt mọi nơi gọi đổi đường nhập: `useNotificationCenter`
 * và `index.ts` vẫn đọc hình dạng của màn từ đúng một file, và cái tên vẫn phân
 * giải về một khai báo duy nhất.
 *
 * Ma trận cài đặt tài khoản (S-05, `useAccountTables.ts:115-141`) có **năm**
 * dòng; `morningDigest` cố ý vắng mặt ở cả hai tầng. Cấm tuyệt đối của màn này
 * là "mọi thông báo phải dẫn tới một đối tượng cụ thể", mà bản tổng hợp mỗi
 * sáng gộp nhiều việc nên không có đối tượng nào để dẫn tới. Nó là thư điện tử
 * theo mặc định của chính ma trận ấy (`email: true, inApp: false`), và nó ở lại
 * bên đó.
 */
export { NOTIFICATION_KINDS } from '@/api/schemas/notifications';
export type { NotificationKind };

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
   * `'navigate'` chỉ mở một màn; `'accept'` GHI trước rồi mới mở.
   *
   * `'accept'` có nguồn sinh ra thật kể từ lượt nối dây: mục `projectInvite`
   * mang nhãn "chấp nhận", và bấm vào gọi
   * {@link NotificationCenterGateway.acceptInvite} → `client.notifications.acceptInvite`
   * → `ENDPOINTS.notifications.acceptInvite(notificationId)`. Trước đó nhãn là
   * "xem lời mời" với `'navigate'`, vì chưa có phép ghi nào để gọi và một nút
   * ghi "chấp nhận" mà chỉ điều hướng là đúng thứ R-69 cấm.
   *
   * Hai giá trị này quyết định cả hành vi của tấm trượt:
   * `NotificationCenter.tsx` đóng tấm trượt sau một `'navigate'` nhưng GIỮ nó
   * mở sau một `'accept'` — người vừa nhận lời mời còn phải thấy dòng ấy đổi
   * trạng thái.
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
 * Cổng dữ liệu của trung tâm thông báo — đã nối dây thật (T-09).
 *
 * ## Cổng là ranh giới, và nó thật cả năm phép
 *
 * Mỗi phép dưới đây chạy qua tầng dữ liệu dùng chung, không qua bộ nhớ nào của
 * riêng màn: `client.notifications.{list,markRead,markAllRead,acceptInvite}`
 * trên `ENDPOINTS.notifications`, và `createEventChannel` cho kênh thời gian
 * thực. Xem `notificationCenterGateway.ts` cho từng đường một.
 *
 * ## Vì sao `subscribe` vẫn nhận `listener` chứ không trả về một `EventSource`
 *
 * Đặc tả cấm màn tự mở kết nối. Chữ ký này giữ lời hứa ấy bằng cấu trúc: cổng
 * là nơi DUY NHẤT biết tới một kết nối, và thứ nó trả ra ngoài chỉ là một hàm
 * huỷ đăng ký. Không có `new EventSource`, không có `fetch`, không có hẹn giờ
 * hỏi lại ở bất kỳ đâu khác trong thư mục màn — và vì cổng dùng
 * `createEventChannel` dùng chung, nó cũng không tự viết lại phép thử-lại
 * hay phép đọc gói tin.
 *
 * Chữ ký này KHÔNG đổi khi bộ nhớ trong bị gỡ: `useNotificationCenter` gọi
 * đúng những phép cũ với đúng những kiểu cũ. Phép thứ năm — `acceptInvite` —
 * là thứ được THÊM, không phải thứ bị đổi; xem chú thích của nó.
 */
export interface NotificationCenterGateway {
  /** Đọc danh sách. Ném lỗi khi hỏng — tầng trên bắt và vẽ trạng thái 4. */
  readonly list: () => Promise<readonly NotificationItemVm[]>;
  /** Đánh dấu đã đọc. Gọi khi người dùng làm việc đó, không bao giờ tự động. */
  readonly markRead: (ids: readonly string[]) => Promise<void>;
  readonly markAllRead: () => Promise<void>;
  /**
   * Chấp nhận một lời mời vào dự án. Ném lỗi khi hỏng, như {@link list}.
   *
   * Phép ghi MỚI của lượt nối dây, và là lý do `NotificationInlineAction.kind`
   * có nhánh `'accept'` sinh ra được. Nó nhận `notificationId` chứ không phải
   * `inviteId` vì đường của nó là
   * `ENDPOINTS.notifications.acceptInvite(notificationId)` — người nhận chấp
   * nhận từ chính thông báo họ đang đọc, không phải từ một tài nguyên lời mời
   * mà màn này không cầm mã.
   *
   * Khác `UsersApi.invite`/`resendInvite`: hai cái đó là việc của quản trị
   * viên GỬI lời mời (S-06). Đây là phía NHẬN.
   */
  readonly acceptInvite: (notificationId: string) => Promise<void>;
  /**
   * Đăng ký nhận thông báo mới tới. Trả về hàm huỷ đăng ký.
   *
   * Đây là cửa duy nhất thông báo mới đi vào màn.
   */
  readonly subscribe: (listener: (arrived: NotificationItemVm) => void) => () => void;
}

/** Trạng thái màn, dùng lại đúng bảy tên của A11 (khuôn `useEditorTour.ts:107`). */
export type NotificationScreenState = SevenState;
