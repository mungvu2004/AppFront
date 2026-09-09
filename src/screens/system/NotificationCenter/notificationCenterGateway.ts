/**
 * Nguồn dữ liệu của trung tâm thông báo — dây thật, không còn bộ nhớ trong.
 *
 * ## Năm phép, năm đường thật
 *
 * | Phép của cổng | Đi qua |
 * |---|---|
 * | `list` | `client.notifications.list()` → `ENDPOINTS.notifications.list` |
 * | `markRead` | `client.notifications.markRead()` → `…markRead` |
 * | `markAllRead` | `client.notifications.markAllRead()` → `…markAllRead` |
 * | `acceptInvite` | `client.notifications.acceptInvite()` → `…acceptInvite(id)` |
 * | `subscribe` | `createEventChannel` → `…stream` |
 *
 * Không còn `pushNotification`, không còn `resetNotificationCenterStore`, không
 * còn bộ mẫu bảy mục: chúng là bộ khung chống đỡ của khoản nợ T-09 và khoản nợ
 * ấy đã trả. Bộ mẫu cho bộ kiểm và Storybook nay là `MOCK_NOTIFICATIONS`
 * (`src/api/__mocks__/client.ts`), tức cùng bộ dữ liệu mà mọi tầng khác đọc —
 * `createAppApiClient()` tự chọn client giả hay client thật theo môi trường,
 * nên màn không có nhánh nào phải tự quyết định điều đó.
 *
 * ## Màn không mở kết nối; cổng cũng không TỰ VIẾT một kết nối
 *
 * `subscribe` dùng `createEventChannel` (`lib/realtime/eventChannel.ts`) dùng
 * chung — cùng hàm mà `createProgressStream` dùng — nên phép thử lại có lùi
 * theo cấp số nhân, phép nối lại và phép đọc gói tin đều là mã đã có test, chứ
 * không phải một `new EventSource` viết tay trong thư mục màn.
 *
 * Hai tuỳ chọn của kênh đều được truyền **có chủ ý**:
 *
 * - `schema: NotificationSchema` — nếu bỏ trống, kênh phân tích gói tin bằng
 *   `ProgressSchema` và mọi thông báo bị loại.
 * - `eventType: NOTIFICATION_EVENT_TYPE` — nếu bỏ trống, mọi thông báo đi ra
 *   với `type: 'progress'`, một lời nói dối nằm ngay trong kiểu. `eventType`
 *   tồn tại chính vì chỗ này.
 *
 * ## Vì sao bảng đích vẫn nằm ở đây
 *
 * "Mọi thông báo phải dẫn tới một đối tượng cụ thể" là cấm tuyệt đối của màn.
 * Cách giữ lời hứa đó bằng cấu trúc là để {@link resolveNotificationTo} là **con
 * đường duy nhất** dựng `target.to`, và để nó không có nhánh nào trả về
 * `ROUTES.dashboard`. Cái ĐỔI so với bản bộ nhớ trong là nơi `place` đến từ:
 * trước đây bộ mẫu tự gán, nay máy chủ nói ra (`NotificationSchema.place`, bắt
 * buộc). Suy `place` từ `kind` ở đây là bịa — một lượt chuẩn hoá bề dày mở ra
 * màn tường vẫn "chạy", chỉ là dẫn sai chỗ và không ai thấy.
 */

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiResult, Notification } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { NOTIFICATION_PLACES, NotificationSchema } from '@/api/schemas/notifications';
import type { NotificationPlace } from '@/api/schemas/notifications';
import { formatTimestamp } from '@/lib/format/datetime';
import { createEventChannel } from '@/lib/realtime/eventChannel';
import { ROUTES } from '@/routes/paths';

import type {
  NotificationCenterGateway,
  NotificationInlineAction,
  NotificationItemVm,
  NotificationKind,
  NotificationTarget,
} from './notificationModel';

/**
 * Chín nơi một thông báo được phép dẫn tới — MỘT bản, giữ ở tầng API.
 *
 * Xuất lại qua đây vì bảng đích bên dưới là người dùng nó, và vì `index.ts`
 * cùng bộ kiểm đã quen đường nhập này. Khai báo thật nằm ở
 * `src/api/schemas/notifications.ts`, cạnh `z.enum` đọc nó từ gói tin — cùng lý
 * lẽ mà `NOTIFICATION_KINDS` đã chuyển về đó.
 */
export { NOTIFICATION_PLACES };
export type { NotificationPlace };

/* -------------------------------------------------------------------------- */
/* 1 — Bảng đích: mỗi thông báo dẫn tới màn duyệt của chính nó                 */
/* -------------------------------------------------------------------------- */

/** Sáu nơi cần biết ĐANG Ở TẦNG NÀO mới dựng được đường dẫn. */
const FLOOR_SCOPED_PLACES: ReadonlySet<NotificationPlace> = new Set<NotificationPlace>([
  'walls',
  'objects',
  'dimensions',
  'grids',
  'rooms',
  'thickness',
]);

/**
 * Dựng đường dẫn của một thông báo. Con đường DUY NHẤT dựng `target.to`.
 *
 * R-65 cấm chuỗi bắt đầu bằng `/` trong `src/screens`, nên mọi nhánh dưới đây
 * gọi một hàm trong `ROUTES` (`@/routes/paths`) chứ không ghép chuỗi.
 *
 * `projectInvite` đi tới **`ROUTES.project.settings`**, không phải
 * `ROUTES.project.share`. Lý do: `share` là màn TẠO liên kết chia sẻ cho người
 * ngoài, còn lời mời là việc của thành viên — thứ người nhận cần thấy khi bấm
 * vào là dự án họ vừa được thêm vào và vai của họ trong đó, và đó là màn cài đặt
 * dự án. Bấm vào lời mời rồi rơi vào màn tạo liên kết là một câu trả lời cho câu
 * hỏi không ai hỏi.
 *
 * Khi một nơi theo tầng thiếu `floorId` — dữ liệu hỏng, không phải luồng thường
 * — đích lùi về danh sách tầng của ĐÚNG dự án ấy. Vẫn là một đối tượng cụ thể,
 * vẫn không phải bảng điều khiển.
 */
export function resolveNotificationTo(
  place: NotificationPlace,
  projectId: string,
  floorId?: string | undefined,
): string {
  if (FLOOR_SCOPED_PLACES.has(place) && (floorId === undefined || floorId === '')) {
    return ROUTES.project.floors(projectId);
  }

  const floor = floorId ?? '';

  switch (place) {
    case 'walls':
      return ROUTES.project.walls(projectId, floor);
    case 'objects':
      return ROUTES.project.objects(projectId, floor);
    case 'dimensions':
      return ROUTES.project.dimensions(projectId, floor);
    case 'grids':
      return ROUTES.project.grids(projectId, floor);
    case 'rooms':
      return ROUTES.project.rooms(projectId, floor);
    case 'thickness':
      return ROUTES.project.thickness(projectId, floor);
    case 'floors':
      return ROUTES.project.floors(projectId);
    case 'rules':
      return ROUTES.project.rules(projectId);
    case 'projectSettings':
      return ROUTES.project.settings(projectId);
  }
}

/** Thứ {@link createNotificationTarget} cần để dựng một đích đầy đủ. */
export interface NotificationTargetInput {
  readonly place: NotificationPlace;
  readonly projectId: string;
  readonly projectName: string;
  readonly floorId?: string | undefined;
  /** Chữ hiển thị của liên kết nằm trong câu: tên đối tượng, không phải tên màn. */
  readonly label: string;
}

/**
 * Dựng một {@link NotificationTarget} đã có `to` đúng.
 *
 * Xuất khẩu để story và bài kiểm dựng mục mẫu bằng CÙNG bảng đích mà phép đổi
 * gói tin → viewmodel dùng — một bản đích thứ hai gõ tay sẽ lệch đúng vào lúc
 * `ROUTES` đổi.
 */
export function createNotificationTarget(input: NotificationTargetInput): NotificationTarget {
  return {
    projectId: input.projectId,
    projectName: input.projectName,
    floorId: input.floorId,
    label: input.label,
    to: resolveNotificationTo(input.place, input.projectId, input.floorId),
  };
}

/* -------------------------------------------------------------------------- */
/* 2 — Gói tin → viewmodel                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Nhãn của nút hành động trong dòng, theo loại thông báo.
 *
 * `projectInvite` là loại DUY NHẤT mang `'accept'`: nó có một phép ghi thật để
 * gọi (`NotificationCenterGateway.acceptInvite`). Ba loại còn lại chỉ mở một
 * màn, nên nhãn của chúng nói đúng chừng ấy — A6, viết thường kiểu câu.
 */
const INLINE_ACTION_BY_KIND: Readonly<Record<NotificationKind, NotificationInlineAction>> =
  Object.freeze({
    aiCompleted: { label: 'xem kết quả', kind: 'navigate' },
    commentMention: { label: 'xem bình luận', kind: 'navigate' },
    projectInvite: { label: 'chấp nhận', kind: 'accept' },
    violationFound: { label: 'xem lỗi', kind: 'navigate' },
  } as const);

/**
 * Đổi một thông báo trên dây thành một mục của màn.
 *
 * Hàm có TÊN, không phải một lambda trong `list`: nó là chỗ hai hình dạng gặp
 * nhau, và cả `list` lẫn `subscribe` đều đi qua nó — một mục trượt vào bằng
 * kênh thời gian thực phải giống hệt một mục đọc bằng `list`, nếu không thì
 * cùng một thông báo trông khác nhau tuỳ vào việc nó tới lúc nào.
 *
 * Bốn điều xảy ra ở đây và không xảy ra ở nơi nào khác:
 *
 * - `createdAt` đổi từ ISO 8601 sang epoch ms, vì hook gộp theo ngày bằng số.
 * - `relativeTime` dựng bằng `formatTimestamp` (A15 — định dạng ở viewmodel,
 *   không ở view). Đây là giá trị MỒI: hook có đồng hồ tiêm vào và dựng lại
 *   chuỗi này mỗi lượt render, nhưng hợp đồng khai trường là bắt buộc và một
 *   mục đọc thẳng từ cổng vẫn phải đọc được.
 * - `message` của máy chủ thành `sentence`, `objectLabel` thành chữ của liên
 *   kết. Hai trường tách nhau trên dây đúng vì chúng có hai vai khác nhau.
 * - `place` của máy chủ thành `target.to` qua {@link createNotificationTarget}.
 */
export function toNotificationItemVm(notification: Notification, nowMs: number): NotificationItemVm {
  const createdAt = Date.parse(notification.createdAt);

  return {
    id: notification.id,
    kind: notification.kind,
    sentence: notification.message,
    target: createNotificationTarget({
      place: notification.place,
      projectId: notification.projectId,
      projectName: notification.projectName,
      floorId: notification.floorId,
      label: notification.objectLabel,
    }),
    createdAt,
    relativeTime: formatTimestamp(createdAt, nowMs),
    isRead: notification.isRead,
    excerpt: notification.excerpt,
    inlineAction: INLINE_ACTION_BY_KIND[notification.kind],
  };
}

/* -------------------------------------------------------------------------- */
/* 3 — Cổng                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Nhãn gắn vào `ChannelEvent.type` cho gói tin của kênh này.
 *
 * KHÔNG để `createEventChannel` dùng mặc định `'progress'`: một thông báo mang
 * nhãn `'progress'` là một lời nói dối nằm trong kiểu, và `ChannelEvent.type`
 * trở thành một trường không nói gì. Đây là toàn bộ lý do tham số `eventType`
 * tồn tại.
 */
const NOTIFICATION_EVENT_TYPE = 'notification';

/**
 * Mở gói một `ApiResult`, ném lỗi khi hỏng.
 *
 * Hợp đồng của cổng nói "ném lỗi khi hỏng — tầng trên bắt và vẽ trạng thái 4",
 * còn tầng API trả `Result`. Đây là đúng một chỗ hai quy ước ấy gặp nhau; lỗi
 * ném ra nguyên vẹn để `toAppError`/`describeError` ở hook dựng được câu tiếng
 * Việt từ chính nó thay vì từ một `Error` gói lại làm mất mã trạng thái.
 */
function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw result.error;
  }

  return result.data;
}

/**
 * Cổng thật của ứng dụng.
 *
 * Nhận `ApiClient` qua tham số — cùng khuôn `createProjectSettingsGateway` — để
 * bộ kiểm cắm `createMockApiClient()` vào đúng phép ánh xạ mà bản sản phẩm dùng
 * thay vì dựng một ý niệm thứ hai về hình dạng câu trả lời (R-70). Bỏ trống thì
 * lấy client của ứng dụng, nên `useNotificationCenter` gọi
 * `createNotificationCenterGateway()` không đổi một chữ.
 *
 * `now` cũng tiêm được vì `formatTimestamp` là hàm thuần của hai tham số: một
 * bài kiểm cần "18 phút trước" phải nói được bây giờ là lúc nào.
 */
export function createNotificationCenterGateway(
  client: ApiClient = createAppApiClient(),
  now: () => number = Date.now,
): NotificationCenterGateway {
  return {
    list: async () => {
      const nowMs = now();

      return unwrap(await client.notifications.list()).map((notification) =>
        toNotificationItemVm(notification, nowMs),
      );
    },

    markRead: async (ids) => {
      // `MarkNotificationsReadSchema.ids` là `.min(1)`: một yêu cầu không mang
      // id nào là một lượt gọi sai chỗ, không phải "đánh dấu không gì cả". Hook
      // không gọi như vậy, và nếu có thì nó không đi ra dây.
      if (ids.length === 0) {
        return;
      }

      unwrap(await client.notifications.markRead({ body: { ids: [...ids] } }));
    },

    markAllRead: async () => {
      unwrap(await client.notifications.markAllRead());
    },

    acceptInvite: async (notificationId) => {
      // Máy chủ trả về chính thông báo vừa đổi; nơi gọi chỉ cần biết nó xong, và
      // dòng mới đi vào màn bằng lượt đọc lại mà `invalidationMap.acceptInvite`
      // kích hoạt — không phải bằng một bản vá tại chỗ dựng ở đây.
      unwrap(await client.notifications.acceptInvite({ notificationId }));
    },

    subscribe: (listener) => {
      const channel = createEventChannel({
        url: ENDPOINTS.notifications.stream,
        schema: NotificationSchema,
        eventType: NOTIFICATION_EVENT_TYPE,
        onEvent: (event) => {
          listener(toNotificationItemVm(event.data, now()));
        },
        // Trạng thái kết nối không có mặt trong chữ ký `subscribe`, và màn không
        // có chỗ nào vẽ nó: bảy trạng thái của A11 nói về LƯỢT ĐỌC danh sách,
        // không về đường SSE. Kênh tự thử lại có lùi theo cấp số nhân, nên mất
        // sóng một lát là việc nó tự giải quyết. Tham số này bắt buộc phải có,
        // nên đây là một lời từ chối có chú thích, không phải chỗ bỏ quên.
        onStateChange: () => undefined,
      });

      return () => {
        channel.close();
      };
    },
  };
}
