/**
 * Toàn bộ phần suy nghĩ của trung tâm thông báo.
 *
 * Mục D chia đôi: file này giữ trạng thái và làm mọi phép tính;
 * `NotificationCenter.tsx` chỉ vẽ thứ {@link UseNotificationCenterResult} đưa
 * cho. View không đọc `createdAt` để tự định dạng, không tự cắt ngưỡng huy hiệu,
 * và không tự gộp theo ngày — cả ba việc ấy xảy ra ở đây (A15).
 *
 * ## R-61 — file này NỐI LẠI logic đã có, không chứa công thức tự chế
 *
 * | Việc | Đi qua |
 * |---|---|
 * | Đọc danh sách | `useQuery` + {@link NotificationCenterGateway.list} |
 * | Thời gian tương đối | `formatTimestamp` (`lib/format/datetime.ts:184`, P-02) |
 * | Gộp theo ngày | `isSameCalendarDay` (`datetime.ts:129`) |
 * | Tiêu đề ngày cũ | `formatCalendarDate` (`datetime.ts:153`) |
 * | Ghi lạc quan | `createOptimisticMutation` (`src/lib/mutations`) |
 * | Câu lỗi tiếng Việt | `describeError(toAppError(…))` (`src/lib/errors`) |
 * | Thời lượng chuyển động | `MOTION_DURATIONS_MS` (`@/lib/motion/tokens`) |
 * | Số của huy hiệu | `formatNumber` (`lib/format/number.ts:201`) |
 * | Đường dẫn | `ROUTES`, qua `notificationCenterGateway.ts` |
 *
 * **Không** có một phép chia mili-giây nào trong file này. "Cùng ngày" là một
 * câu hỏi về múi giờ, không phải về 86.400.000 — `isSameCalendarDay` giải thích
 * tại sao ngay trong chú thích của nó, và viết lại phép ấy ở đây là dựng nguồn
 * sự thật thứ hai mà R-71 cấm.
 *
 * ## Trạng thái máy chủ: `useQuery` / `useMutation`, không `useState` (R-64)
 *
 * Không một `useState` nào ở đây giữ trạng thái máy chủ: cờ đang tải và câu báo
 * hỏng đọc thẳng từ `useQuery`. `hooks/useShareLinks.ts` tự nuôi hai thứ ấy bằng
 * tay — đó là **ngoại lệ đi trước, không phải khuôn mẫu để chép**. `useState` ở
 * đây chỉ giữ lựa chọn và hiệu ứng của người dùng: bộ lọc đang chọn, mã nhắc
 * chuông, và tập id vừa trượt vào.
 *
 * ## Mở tấm trượt KHÔNG đánh dấu gì là đã đọc
 *
 * Không có `useEffect` nào trong file này gọi `markRead`. Cửa duy nhất dẫn tới
 * {@link NotificationCenterGateway.markRead} là ba hàm người dùng bấm —
 * {@link UseNotificationCenterResult.markRead},
 * {@link UseNotificationCenterResult.markAllRead} và
 * {@link UseNotificationCenterResult.openNotification}. Mở rồi đóng tấm trượt
 * không gọi hàm nào trong ba hàm ấy, nên `unreadCount` không đổi. Đó là lời hứa
 * được giữ bằng cấu trúc chứ không bằng trí nhớ.
 *
 * `openNotification` CÓ đánh dấu, và đó không phải ngoại lệ: bấm vào một thông
 * báo là người dùng tự tay đọc nó, đúng điều hợp đồng nói ("gọi khi người dùng
 * làm việc đó, không bao giờ tự động"). Bài kiểm của người duyệt là mở rồi đóng,
 * không phải mở rồi bấm.
 *
 * ## Hai lệch có chủ ý, ghi ở đây để không ai "sửa" nhầm
 *
 * 1. **Mục mới trượt vào trong 260 ms, không phải 240.** Thang chuyển động có
 *    đúng bốn giá trị (`MOTION_DURATIONS_MS`); 240 không nằm trong đó và
 *    `local/no-raw-duration` chặn ở mức `error`. `standard` là giá trị hợp lệ
 *    gần nhất, và người duyệt đã chốt điều này.
 * 2. **`enabledKinds` do hook này sở hữu, mặc định bật hết.** Ma trận thật nằm ở
 *    màn cài đặt tài khoản (S-05), nhưng bộ giải mã của nó (`readMatrix`,
 *    `NOTIFICATION_EVENTS`) là PRIVATE trong `useAccountTables.ts:115,154` và
 *    S-05 là màn đã xong nên không được sửa để thêm `export`. Chép `readMatrix`
 *    vào thư mục này sẽ là nguồn sự thật thứ hai — đúng thứ R-71 cấm. Nên hôm
 *    nay tuỳ chọn là một tham số tiêm vào, `settingsTo` dẫn người dùng sang
 *    S-05, và nối hai nơi làm một là phần của khoản nợ **T-09**.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { describeError, toAppError } from '@/lib/errors';
import { formatCalendarDate, formatTimestamp, isSameCalendarDay } from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { createOptimisticMutation } from '@/lib/mutations/createOptimisticMutation';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys, type QueryKey } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';

import { createNotificationCenterGateway } from './notificationCenterGateway';
import {
  NOTIFICATION_FILTERS,
  NOTIFICATION_FILTER_LABELS,
  NOTIFICATION_KINDS,
  UNREAD_BADGE_CAP,
  type NotificationCenterGateway,
  type NotificationDayGroup,
  type NotificationFilter,
  type NotificationItemVm,
  type NotificationKind,
  type NotificationScreenState,
} from './notificationModel';

/* -------------------------------------------------------------------------- */
/* 1 — Khoá bộ đệm                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Khoá bộ đệm của lượt đọc danh sách thông báo — lấy từ `queryKeys`.
 *
 * Trước lượt nối dây, hằng này được gõ tay ở đây (`['notification','list']`) vì
 * `queryKeys` chưa có nhánh `notification`. Nhánh ấy nay đã có, nên khoá đến từ
 * đó: một khoá viết tay trong thư mục màn là nguồn sự thật thứ hai cho cùng một
 * quyết định, đúng thứ R-71 cấm, và nó lệch trong im lặng — hai chuỗi khác nhau
 * chỉ tạo ra hai mục cache, không tạo ra một lỗi nào.
 *
 * Bậc cache không còn phải ghi ở đây nữa: `TIER_BY_DOMAIN`
 * (`lib/query/cachePolicy.ts`) nay khai thẳng `notification: 'default'`, nên
 * `staleTime` 30 giây là một quyết định đã xác nhận ở tầng giữ chính sách chứ
 * không phải hệ quả của một miền bị bỏ sót.
 *
 * Vẫn xuất khẩu dưới tên cũ: `index.ts` xuất lại nó, và một tên ổn định là thứ
 * rẻ nhất để giữ.
 */
export const notificationListQueryKey: QueryKey = queryKeys.notification.list();

/**
 * Mọi phép ghi của màn dùng chung một `entityId`.
 *
 * `createOptimisticMutation` xếp hàng theo `entityId` (`entityQueue.ts`), và cả
 * `markRead` lẫn `markAllRead` đều viết lại CÙNG một danh sách. Hai id khác nhau
 * sẽ cho chúng chạy chồng nhau, và ảnh chụp lùi của lượt hỏng sẽ xoá mất kết quả
 * của lượt kia.
 */
const NOTIFICATION_ENTITY_ID = 'notification-inbox';

/* -------------------------------------------------------------------------- */
/* 2 — Chữ của hook (A6)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu tiếng Việt hook này sinh ra, gom một chỗ.
 *
 * Xuất khẩu để bài kiểm đối chiếu ĐÚNG chuỗi này thay vì gõ lại một bản thứ hai
 * (R-70), đúng vai `USER_MANAGEMENT_TEXT` giữ ở màn anh em.
 *
 * Không cần khoá nào trong `src/i18n/vi.json`: cả năm câu đều mang dấu tiếng
 * Việt, nên `expectVietnamese` nhận chúng ở bước 1 (dấu) mà không phải hỏi tới
 * từ điển ở bước 2 — xem `lib/testing/expectVietnamese.ts:22-27`.
 */
export const NOTIFICATION_CENTER_TEXT = {
  headingToday: 'Hôm nay',
  headingYesterday: 'Hôm qua',
  liveEmpty: 'không có thông báo nào',
  loadFailed: 'không đọc được danh sách thông báo',
  markReadFailed: 'không đánh dấu được là đã đọc',
  settingsLabel: 'cài đặt thông báo',
} as const;

/** Câu của vùng `aria-live` khi còn mục chưa đọc. Một chỗ dựng, một chỗ sửa. */
function unreadLiveMessage(badge: string): string {
  return `có ${badge} thông báo chưa đọc`;
}

/* -------------------------------------------------------------------------- */
/* 3 — Chữ ký view và test đọc                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Vùng cuộn của danh sách, nhìn từ phía hook.
 *
 * Đúng ba thuộc tính, và một `HTMLElement` thoả chúng theo cấu trúc — nên view
 * gắn `ref={scrollRef}` thẳng vào `<div>` cuộn của nó, còn bài kiểm đưa vào một
 * đối tượng thường `{ scrollTop: 400, scrollHeight: 2000 }` mà không cần DOM.
 * Hook không bao giờ chạm tới thứ gì khác của phần tử ấy.
 */
export interface NotificationScrollSurface {
  scrollTop: number;
  readonly scrollHeight: number;
}

/** Một lựa chọn của dải lọc, nhãn đã lấy sẵn từ hợp đồng. */
export interface NotificationFilterOption {
  readonly value: NotificationFilter;
  readonly label: string;
}

/** Cách gọi hook trong test và story. Sản phẩm gọi `useNotificationCenter()` không tham số. */
export interface UseNotificationCenterOptions {
  /** Nguồn dữ liệu. Mặc định là cổng thật của ứng dụng. */
  readonly gateway?: NotificationCenterGateway;
  /** Đồng hồ tiêm vào, cho `fakeClock`. Mặc định `Date.now`. */
  readonly now?: () => number;
  /** Điều hướng. Màn gọi nó rồi mới đóng tấm trượt. */
  readonly onNavigate?: (to: string) => void;
  /** Đóng tấm trượt. Gọi SAU `onNavigate`, không bao giờ trước. */
  readonly onClose?: () => void;
  /**
   * Những loại người dùng còn bật, theo ma trận của S-05. Mặc định bật hết.
   * Xem chú thích đầu file về nợ T-09.
   */
  readonly enabledKinds?: readonly NotificationKind[];
  /** Bề ngang hẹp — view đo, hook chỉ đặt tên. Đổi `screenState` thành `'collapsed'`. */
  readonly isCompact?: boolean;
  /**
   * Tấm trượt đang mở hay không, khi NGƯỜI GỌI muốn tự giữ trạng thái ấy.
   *
   * Bỏ trống thì hook tự giữ (`useState`) và `onToggle` đổi nó — đủ cho một
   * chuông đứng một mình. Truyền vào thì hook không giữ nữa, và người gọi phải
   * tự đổi khi `onToggle`/`onClose` gọi tới: đó là cách một màn chủ đã có
   * trạng thái mở của riêng nó cắm vào mà không có hai nguồn sự thật.
   */
  readonly isOpen?: boolean;
}

/**
 * Thứ view nhận. Một đối tượng, một prop.
 *
 * ## Vì sao kiểu này khai ở ĐÂY chứ không ở `NotificationCenter.tsx`
 *
 * Đúng khuôn `EditorTourProps` xuất từ `useEditorTour.ts`: kiểu dùng chung có
 * MỘT nguồn, và nguồn ấy là tầng logic. View nhập lại bằng `import type`, bài
 * kiểm cũng vậy — nên không ai phải nhập từ file của người khác để biết mình
 * nhận gì, và không có bản khai thứ hai để lệch.
 *
 * ## Vì sao mọi trường đều bắt buộc
 *
 * View này thuần và test được chỉ từ props (mục D). Một `onMarkRead?` tuỳ chọn
 * sẽ bắt view tự đoán khi không ai truyền, tức là logic quay lại nằm trong
 * view. Hook luôn cấp đủ, và bài kiểm dựng đủ — nên không trường nào tuỳ chọn.
 */
export interface NotificationCenterProps {
  /** Bảy trạng thái của A11. */
  readonly screenState: NotificationScreenState;
  /** Tấm trượt đang mở hay không. */
  readonly isOpen: boolean;
  /** Bề ngang hẹp — trạng thái 7 "thu gọn", tấm trượt trải toàn màn. */
  readonly isCollapsed: boolean;

  /** Đã lọc, đã gộp theo ngày, mới trước. Rỗng khi đang tải hoặc khi lọc không khớp. */
  readonly groups: readonly NotificationDayGroup[];
  readonly filter: NotificationFilter;
  readonly onFilterChange: (next: NotificationFilter) => void;

  /** Số mục chưa đọc trong những loại đang bật. KHÔNG phụ thuộc bộ lọc đang chọn. */
  readonly unreadCount: number;
  /**
   * `unreadCount` đã cắt ngưỡng: "9+" khi vượt {@link UNREAD_BADGE_CAP}. Cắt ở
   * hook, không ở view (A15). Chuỗi RỖNG nghĩa là không có gì chưa đọc — không
   * phải `null`, để view chỉ có một phép thử và bài kiểm chỉ có một quy ước.
   */
  readonly unreadBadge: string;

  /**
   * Câu cho vùng `aria-live` — trình đọc màn hình nghe được số chưa đọc đổi mà
   * không phải đi dò lại danh sách. Dựng ở hook vì nó là chữ sinh từ dữ liệu
   * (A15), không phải nhãn tĩnh của view.
   */
  readonly liveMessage: string;

  /** Câu lỗi tiếng Việt của lượt đọc; `null` khi đọc được. */
  readonly errorMessage: string | null;

  /** Mở/đóng tấm trượt. Dành cho chuông và cho phím tắt. */
  readonly onToggle: () => void;
  /** Đóng tấm trượt. KHÔNG bao giờ tự đánh dấu đã đọc — xem bài nghiệm thu 2. */
  readonly onClose: () => void;
  /** Bấm vào câu của một mục: đánh dấu đã đọc, điều hướng, rồi đóng. */
  readonly onItemClick: (item: NotificationItemVm) => void;
  /** Bấm nút hành động ngay trong dòng ("xem kết quả"). */
  readonly onInlineAction: (item: NotificationItemVm) => void;
  /** Đánh dấu một mục. Chỉ gọi khi người dùng bấm. */
  readonly onMarkRead: (id: string) => void;
  /** Đánh dấu tất cả. Chỉ gọi khi người dùng bấm. */
  readonly onMarkAllRead: () => void;
  /** "Xem tất cả" — sang route toàn màn `/thong-bao`. */
  readonly onViewAll: () => void;
  /** "Cài đặt thông báo" — sang ma trận của S-05. */
  readonly onOpenSettings: () => void;
  /** Đọc lại sau khi lỗi. */
  readonly onRetry: () => void;

  /** Những id vừa trượt vào, để view nháy `--bg-selected`. Tự rỗng lại sau `standard` (260 ms). */
  readonly arrivedIds: readonly string[];
  /** Tăng đúng MỘT lần mỗi khi một thông báo tới. View dùng làm khoá chạy hoạt ảnh một lần. */
  readonly bellNudgeToken: number;
  /** Ref của vùng cuộn. Gắn vào `<div>` cuộn thì hook mới bù được vị trí. */
  readonly scrollRef: (surface: NotificationScrollSurface | null) => void;
}

/**
 * Thứ hook trả về: đúng props của view, cộng thêm vài thứ chỉ người nối dây cần.
 *
 * Là SIÊU TẬP của {@link NotificationCenterProps} nên `<NotificationCenter {...vm} />`
 * chạy thẳng — JSX spread không kiểm thuộc tính thừa, đúng cách
 * `<EditorTour {...vm} />` đã đi trước.
 */
export interface UseNotificationCenterResult extends NotificationCenterProps {
  /** Ba lựa chọn với nhãn sẵn, để người nối dây khác không lặp qua hằng của hợp đồng. */
  readonly filterOptions: readonly NotificationFilterOption[];
  /** Tiêu đề của khối lỗi đọc. Luôn cùng một câu; câu cụ thể nằm ở `errorMessage`. */
  readonly errorTitle: string;
  /** Câu lỗi của phép đánh dấu vừa hỏng và đã lùi lại; `null` khi không có. */
  readonly mutationErrorMessage: string | null;
  /** Đích của nút "cài đặt" — một chủ sở hữu, một chỗ sửa. */
  readonly settingsTo: string;
  /** Nhãn của nút ấy. */
  readonly settingsLabel: string;
  /** Những loại đang bật, để người gọi nói ra khi danh sách rỗng vì người dùng tắt bớt. */
  readonly enabledKinds: readonly NotificationKind[];
}

/* -------------------------------------------------------------------------- */
/* 4 — Lọc, gộp, đặt tiêu đề                                                   */
/* -------------------------------------------------------------------------- */

/** Một mục có lọt qua bộ lọc đang chọn không. `enabledKinds` đã lọc trước đó. */
function matchesFilter(item: NotificationItemVm, filter: NotificationFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return !item.isRead;
    case 'mentions':
      return item.kind === 'commentMention';
  }
}

/**
 * Một ngày, tính bằng mili giây — dùng ĐÚNG một chỗ: lùi `now` lại một ngày để
 * hỏi {@link isSameCalendarDay} xem một mục có thuộc "hôm qua" không.
 *
 * Đây không phải phép chia mili giây mà R-61 cấm: phép so ngày vẫn do bộ định
 * dạng lịch trả lời, con số này chỉ chọn ra NGÀY để đem đi so.
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tiêu đề của một nhóm ngày.
 *
 * "Hôm nay" và "Hôm qua" hỏi `isSameCalendarDay`, không hỏi hiệu hai mốc: 23:50
 * và 00:10 cách nhau mười phút mà thuộc hai ngày khác nhau, nên một cửa sổ 24
 * giờ là phép thử sai. Ngày xa hơn thì in ngày lịch đầy đủ.
 */
function dayHeading(createdAt: number, nowMs: number): string {
  if (isSameCalendarDay(createdAt, nowMs)) {
    return NOTIFICATION_CENTER_TEXT.headingToday;
  }

  if (isSameCalendarDay(createdAt, nowMs - ONE_DAY_MS)) {
    return NOTIFICATION_CENTER_TEXT.headingYesterday;
  }

  return formatCalendarDate(createdAt);
}

/**
 * Gộp danh sách đã sắp xếp thành nhóm ngày.
 *
 * Chỉ so mục hiện tại với mục ĐẦU của nhóm đang mở — danh sách đã sắp mới trước,
 * nên hai mục cùng ngày luôn nằm cạnh nhau và một lượt duyệt là đủ.
 */
function groupByDay(
  items: readonly NotificationItemVm[],
  nowMs: number,
): readonly NotificationDayGroup[] {
  const groups: NotificationDayGroup[] = [];
  let current: NotificationItemVm[] = [];
  let anchor: NotificationItemVm | null = null;

  const flush = (): void => {
    if (anchor === null || current.length === 0) {
      return;
    }

    groups.push({
      key: formatCalendarDate(anchor.createdAt),
      heading: dayHeading(anchor.createdAt, nowMs),
      items: current,
    });
  };

  for (const item of items) {
    if (anchor !== null && isSameCalendarDay(anchor.createdAt, item.createdAt)) {
      current.push(item);
      continue;
    }

    flush();
    anchor = item;
    current = [item];
  }

  flush();

  return groups;
}

/* -------------------------------------------------------------------------- */
/* 5 — Hook                                                                    */
/* -------------------------------------------------------------------------- */

export function useNotificationCenter(
  options: UseNotificationCenterOptions = {},
): UseNotificationCenterResult {
  const queryClient = useQueryClient();
  const [gateway] = useState(() => options.gateway ?? createNotificationCenterGateway());

  const now = options.now ?? Date.now;
  const enabledKinds = options.enabledKinds ?? NOTIFICATION_KINDS;
  const isCompact = options.isCompact ?? false;
  const { onNavigate, onClose } = options;

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [bellNudgeToken, setBellNudgeToken] = useState(0);
  const [arrivedIds, setArrivedIds] = useState<readonly string[]>([]);

  /* ---- Mở / đóng --------------------------------------------------------- */

  /**
   * Trạng thái mở NỘI BỘ — chỉ dùng khi `options.isOpen` bỏ trống.
   *
   * Một cờ, không phải một `useState` cho dữ liệu máy chủ: R-64 cấm tự viết
   * `isLoading`/`error`, còn "tấm trượt đang mở" là trạng thái giao diện thuần
   * và không có tầng nào khác giữ nó.
   */
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = options.isOpen ?? isOpenInternal;

  const closeDrawer = useCallback((): void => {
    setIsOpenInternal(false);
    onClose?.();
  }, [onClose]);

  const onToggle = useCallback((): void => {
    setIsOpenInternal((current) => !current);
  }, []);

  const listQuery = useQuery({
    queryKey: notificationListQueryKey,
    queryFn: () => gateway.list(),
  });

  const items = useMemo<readonly NotificationItemVm[]>(() => listQuery.data ?? [], [listQuery.data]);

  /* ---- Giữ vị trí cuộn khi mục mới chen vào ĐẦU danh sách ---------------- */

  const surfaceRef = useRef<NotificationScrollSurface | null>(null);
  /**
   * Chiều cao đo được NGAY TRƯỚC lượt render đầu tiên của một loạt mục mới.
   *
   * `null` nghĩa là không có gì phải bù. Lần đo ĐẦU của loạt được giữ lại và
   * những lần sau bỏ qua: React gộp năm lần `setState` liên tiếp thành một lượt
   * vẽ, nên chiều cao "trước" đúng là chiều cao trước mục thứ nhất, và một phép
   * bù duy nhất bù đủ cả năm.
   */
  const heightBeforeArrivalRef = useRef<number | null>(null);

  const scrollRef = useCallback((surface: NotificationScrollSurface | null): void => {
    surfaceRef.current = surface;
  }, []);

  /**
   * Bù lại đúng phần chiều cao vừa thêm.
   *
   * `useLayoutEffect` chứ không `useEffect`: phép bù phải xong TRƯỚC khi trình
   * duyệt vẽ, nếu không người đọc thấy chữ nhảy lên một nhịp rồi mới trở lại.
   * Chỉ bù khi người dùng đang cuộn (`scrollTop > 0`) — ở đỉnh danh sách thì mục
   * mới trượt vào đúng chỗ nó phải trượt vào, và giữ nguyên vị trí ở đó sẽ là
   * đẩy người dùng xuống khỏi thứ họ vừa mở tấm trượt để xem.
   */
  useLayoutEffect(() => {
    const heightBefore = heightBeforeArrivalRef.current;
    heightBeforeArrivalRef.current = null;

    if (heightBefore === null) {
      return;
    }

    const surface = surfaceRef.current;

    if (surface === null) {
      return;
    }

    const grown = surface.scrollHeight - heightBefore;

    if (grown > 0) {
      surface.scrollTop += grown;
    }
  }, [items]);

  /* ---- Thông báo mới tới ------------------------------------------------- */

  const handleArrived = useCallback(
    (arrived: NotificationItemVm): void => {
      const surface = surfaceRef.current;

      if (surface !== null && surface.scrollTop > 0 && heightBeforeArrivalRef.current === null) {
        heightBeforeArrivalRef.current = surface.scrollHeight;
      }

      queryClient.setQueryData<readonly NotificationItemVm[]>(
        notificationListQueryKey,
        (previous) => (previous === undefined ? [arrived] : [arrived, ...previous]),
      );

      setArrivedIds((current) => [arrived.id, ...current]);
      setBellNudgeToken((token) => token + 1);
    },
    [queryClient],
  );

  // Cửa DUY NHẤT thông báo mới đi vào màn. Không `new EventSource`, không
  // `fetch`, không hẹn giờ hỏi lại — xem chú thích của `NotificationCenterGateway`.
  useEffect(() => gateway.subscribe(handleArrived), [gateway, handleArrived]);

  // Vệt nháy tắt sau đúng một nhịp `standard`. 240 ms của đặc tả không có trong
  // thang chuyển động và `local/no-raw-duration` chặn ở mức `error`.
  useEffect(() => {
    if (arrivedIds.length === 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setArrivedIds([]);
    }, MOTION_DURATIONS_MS.standard);

    return () => {
      clearTimeout(timer);
    };
  }, [arrivedIds]);

  /* ---- Ghi lạc quan ------------------------------------------------------ */

  /**
   * Đánh dấu vài id là đã đọc ngay trong bộ đệm.
   *
   * `rollback` của cả hai phép ghi là hàm rỗng, và đó là đúng: mọi thứ
   * `applyOptimistic` đổi đều nằm TRONG bộ đệm truy vấn, mà
   * `createOptimisticMutation` đã tự chụp lại và trả về khi máy chủ hỏng
   * (`createOptimisticMutation.ts:54-58`). `rollback` chỉ dành cho thứ nằm ngoài
   * bộ đệm, và ở đây không có thứ nào.
   */
  const applyReadInCache = useCallback(
    (ids: readonly string[] | null): void => {
      queryClient.setQueryData<readonly NotificationItemVm[]>(
        notificationListQueryKey,
        (previous) => {
          if (previous === undefined) {
            return previous;
          }

          const wanted = ids === null ? null : new Set(ids);

          return previous.map((item) =>
            item.isRead || (wanted !== null && !wanted.has(item.id))
              ? item
              : { ...item, isRead: true },
          );
        },
      );
    },
    [queryClient],
  );

  const invalidateList = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey: notificationListQueryKey });
  }, [queryClient]);

  const markReadMutation = useMutation(
    createOptimisticMutation<readonly string[], void>(queryClient, {
      affectedKeys: () => [notificationListQueryKey],
      applyOptimistic: (ids) => {
        applyReadInCache(ids);
      },
      callServer: (ids) => gateway.markRead(ids),
      afterSuccess: () => {
        invalidateList();
      },
      entityId: () => NOTIFICATION_ENTITY_ID,
      rollback: () => undefined,
    }),
  );

  const markAllReadMutation = useMutation(
    createOptimisticMutation<null, void>(queryClient, {
      affectedKeys: () => [notificationListQueryKey],
      applyOptimistic: () => {
        applyReadInCache(null);
      },
      callServer: () => gateway.markAllRead(),
      afterSuccess: () => {
        invalidateList();
      },
      entityId: () => NOTIFICATION_ENTITY_ID,
      rollback: () => undefined,
    }),
  );

  /**
   * Chấp nhận một lời mời vào dự án.
   *
   * KHÔNG lạc quan, khác hai phép ghi kia. Đánh dấu đã đọc là một lượt đổi cờ
   * mà màn tự vẽ lại đúng được ngay; chấp nhận lời mời đổi TƯ CÁCH THÀNH VIÊN
   * — nó đổi cả danh sách dự án và danh sách thành viên ở những màn khác — nên
   * thứ đúng để vẽ là điều máy chủ nói, không phải điều màn đoán trước. Vì thế
   * `useMutation` trần, không `createOptimisticMutation`.
   *
   * Ba khoá phải mất hiệu lực chứ không chỉ một, và bảng nói ra điều đó thay
   * cho một lời gọi `invalidateQueries` viết tay ở đây: `invalidationMap.acceptInvite`
   * (`lib/query/invalidation.ts`) liệt kê `notification.list`,
   * `project.members` và `user.memberships`. `applyInvalidation` đọc bảng ấy.
   */
  const acceptInviteMutation = useMutation({
    mutationFn: (item: NotificationItemVm) => gateway.acceptInvite(item.id),
    onSuccess: (_result, item) => {
      applyInvalidation(queryClient, 'acceptInvite', { projectId: item.target.projectId });
    },
  });

  const { mutate: mutateMarkRead } = markReadMutation;
  const { mutate: mutateMarkAllRead } = markAllReadMutation;
  const { mutate: mutateAcceptInvite } = acceptInviteMutation;

  const onMarkRead = useCallback(
    (id: string): void => {
      mutateMarkRead([id]);
    },
    [mutateMarkRead],
  );

  const onMarkAllRead = useCallback((): void => {
    mutateMarkAllRead(null);
  }, [mutateMarkAllRead]);

  /* ---- Mở một thông báo -------------------------------------------------- */

  /**
   * Mở một thông báo: đánh dấu đã đọc → điều hướng → đóng, ĐÚNG thứ tự ấy.
   *
   * Nhận cả mục chứ không chỉ `id`: người gọi (view) đang cầm sẵn mục trong tay
   * lúc dựng dòng, nên bắt hook đi tìm lại trong mảng là một vòng thừa và một
   * nhánh "không tìm thấy" không bao giờ xảy ra mà vẫn phải viết.
   */
  const onItemClick = useCallback(
    (item: NotificationItemVm): void => {
      if (!item.isRead) {
        mutateMarkRead([item.id]);
      }

      // Đích đã được `resolveNotificationTo` phân giải lúc mục được dựng, nên ở
      // đây không có nhánh nào phải đoán và không mục nào thiếu đích.
      onNavigate?.(item.target.to);
      closeDrawer();
    },
    [mutateMarkRead, onNavigate, closeDrawer],
  );

  /**
   * Nút hành động trong dòng — hai đường, theo `inlineAction.kind`.
   *
   * `'navigate'` là đường cũ và đi đúng `onItemClick`: đánh dấu đã đọc, điều
   * hướng, đóng tấm trượt.
   *
   * `'accept'` GHI trước. Nó gọi `gateway.acceptInvite` qua
   * {@link acceptInviteMutation} rồi để lượt đọc lại mang trạng thái mới về —
   * nó KHÔNG điều hướng và KHÔNG đóng tấm trượt, vì người vừa nhận lời mời còn
   * phải thấy dòng ấy đổi. Muốn mở dự án thì bấm vào chính câu của mục, đường
   * `onItemClick` vẫn ở đó.
   *
   * Nhánh này tồn tại vì nếu thiếu nó thì một nút ghi "chấp nhận" chỉ điều
   * hướng — đúng thứ R-69 cấm.
   */
  const onInlineAction = useCallback(
    (item: NotificationItemVm): void => {
      if (item.inlineAction?.kind !== 'accept') {
        onItemClick(item);
        return;
      }

      mutateAcceptInvite(item);
    },
    [onItemClick, mutateAcceptInvite],
  );

  const onViewAll = useCallback((): void => {
    onNavigate?.(ROUTES.notifications);
    closeDrawer();
  }, [onNavigate, closeDrawer]);

  const onOpenSettings = useCallback((): void => {
    onNavigate?.(ROUTES.account);
    closeDrawer();
  }, [onNavigate, closeDrawer]);

  /* ---- Dẫn xuất ---------------------------------------------------------- */

  const nowMs = now();

  /** Những mục người dùng còn bật ở S-05. Bộ lọc của dải chip lọc tiếp từ đây. */
  const visibleItems = useMemo<readonly NotificationItemVm[]>(() => {
    const allowed = new Set(enabledKinds);

    return items.filter((item) => allowed.has(item.kind));
  }, [items, enabledKinds]);

  const unreadCount = useMemo(
    () => visibleItems.filter((item) => !item.isRead).length,
    [visibleItems],
  );

  const unreadBadge =
    unreadCount > UNREAD_BADGE_CAP
      ? `${formatNumber(UNREAD_BADGE_CAP, { fractionDigits: 0 })}+`
      : formatNumber(unreadCount, { fractionDigits: 0 });

  const filteredItems = useMemo<readonly NotificationItemVm[]>(
    () =>
      [...visibleItems]
        .filter((item) => matchesFilter(item, filter))
        .sort((left, right) => right.createdAt - left.createdAt),
    [visibleItems, filter],
  );

  /**
   * `relativeTime` được dựng LẠI ở đây, không lấy giá trị mồi của cổng.
   *
   * `formatTimestamp` không bao giờ đọc `Date.now()` bên trong (P-02), nên chuỗi
   * này là hàm thuần của mốc thời gian và đồng hồ tiêm vào — `fakeClock` đẩy
   * đồng hồ đi thì "vừa xong" thành "12 phút trước" mà không cần lượt đọc nào.
   */
  const groups = useMemo<readonly NotificationDayGroup[]>(
    () =>
      groupByDay(
        filteredItems.map((item) => ({
          ...item,
          relativeTime: formatTimestamp(item.createdAt, nowMs),
        })),
        nowMs,
      ),
    [filteredItems, nowMs],
  );

  const filterOptions = useMemo<readonly NotificationFilterOption[]>(
    () =>
      NOTIFICATION_FILTERS.map((value) => ({
        value,
        label: NOTIFICATION_FILTER_LABELS[value],
      })),
    [],
  );

  /* ---- Bảy trạng thái của A11 ------------------------------------------- */

  const queryError: unknown = listQuery.error;
  const mutationError: unknown = markReadMutation.error ?? markAllReadMutation.error;

  const errorMessage =
    queryError === null || queryError === undefined
      ? null
      : describeError(toAppError(queryError)).description;

  /**
   * Thứ tự quyết định, viết ra một lần để không ai dựng trùng:
   *
   * | # | Trạng thái | Khi nào |
   * |---|---|---|
   * | 2 | `loading` | `isPending` — chưa có mục nào để vẽ |
   * | 4 | `error` | lượt đọc hỏng — không có danh sách |
   * | 6 | `forbidden` | `enabledKinds` rỗng: người dùng tắt hết ở S-05, màn không được phép hiện loại nào |
   * | 1 | `empty` | hộp thư rỗng sau khi lọc theo `enabledKinds` |
   * | 3 | `partial` | có mục, nhưng bộ lọc đang chọn không khớp mục nào, HOẶC một phép đánh dấu vừa hỏng và đã lùi lại |
   * | 7 | `collapsed` | bề ngang hẹp — view đo, hook đặt tên |
   * | 5 | `success` | còn lại |
   */
  const screenState = useMemo<NotificationScreenState>(() => {
    if (listQuery.isPending) {
      return 'loading';
    }

    if (queryError !== null && queryError !== undefined) {
      return 'error';
    }

    if (enabledKinds.length === 0) {
      return 'forbidden';
    }

    if (visibleItems.length === 0) {
      return 'empty';
    }

    if (filteredItems.length === 0 || (mutationError !== null && mutationError !== undefined)) {
      return 'partial';
    }

    if (isCompact) {
      return 'collapsed';
    }

    return 'success';
  }, [
    listQuery.isPending,
    queryError,
    mutationError,
    enabledKinds,
    visibleItems,
    filteredItems,
    isCompact,
  ]);

  const { refetch } = listQuery;

  const onRetry = useCallback((): void => {
    void refetch();
  }, [refetch]);

  /**
   * Câu cho `aria-live`. Lỗi nói ra là lỗi; không còn gì chưa đọc thì nói ra
   * điều đó thay vì im lặng — trình đọc màn hình không thấy được cái danh sách
   * rỗng, nó chỉ nghe được câu này.
   */
  const liveMessage =
    errorMessage !== null
      ? NOTIFICATION_CENTER_TEXT.loadFailed
      : unreadCount === 0
        ? NOTIFICATION_CENTER_TEXT.liveEmpty
        : unreadLiveMessage(unreadBadge);

  return {
    screenState,
    isOpen,
    isCollapsed: isCompact,
    groups,
    filter,
    onFilterChange: setFilter,
    unreadCount,
    unreadBadge: unreadCount === 0 ? '' : unreadBadge,
    liveMessage,
    errorMessage,
    onToggle,
    onClose: closeDrawer,
    onItemClick,
    onInlineAction,
    onMarkRead,
    onMarkAllRead,
    onViewAll,
    onOpenSettings,
    onRetry,
    arrivedIds,
    bellNudgeToken,
    scrollRef,
    filterOptions,
    errorTitle: NOTIFICATION_CENTER_TEXT.loadFailed,
    mutationErrorMessage:
      mutationError === null || mutationError === undefined
        ? null
        : NOTIFICATION_CENTER_TEXT.markReadFailed,
    settingsTo: ROUTES.account,
    settingsLabel: NOTIFICATION_CENTER_TEXT.settingsLabel,
    enabledKinds: [...enabledKinds],
  };
}
