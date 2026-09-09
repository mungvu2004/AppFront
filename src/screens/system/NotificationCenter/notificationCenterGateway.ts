/**
 * Nguồn dữ liệu của trung tâm thông báo.
 *
 * ## Vì sao đây là bộ nhớ trong chứ không phải một lời gọi mạng
 *
 * `src/api/endpoints.ts` hiện có đúng sáu nhóm — `auth.{login,register}`,
 * `drawings`, `featureFlags.read`, `floors`, `projects`, `spatial`. **Không có**
 * nhóm `notifications`; `src/api/client.ts` không có thực thể thông báo;
 * `queryKeys` không có nhánh `notification`; và `WRITE_OPERATIONS`
 * (`lib/query/invalidation.ts:5`) không có phép ghi nào liên quan. `src/api/**`
 * và `src/lib/**` là những thư mục màn này không được sửa. Bịa một đường dẫn ra
 * rồi gọi vào đó cho "trông như thật" là cách chắc chắn nhất để màn hình xanh
 * trên máy người viết và đỏ ở mọi nơi khác.
 *
 * Nên thông báo được giữ trong bộ nhớ của chính module này, đúng khuôn mà
 * `screens/account/AccountSettings/accountSettingsGateway.ts` (nợ T-08) đã đi
 * trước: người dùng đọc được, đánh dấu được, và mọi thứ trở về bộ mẫu khi tải
 * lại trang. Đó là một khoản nợ đã ghi, không phải một lời hứa đã giữ.
 *
 * Mở dây thật là một lượt riêng ở tầng dữ liệu, mã đề xuất **T-09**: thêm nhóm
 * `notifications` vào `ENDPOINTS`, nhánh `queryKeys.notification`, một kênh thời
 * gian thực chở được gói tin không-phải-`Progress`, rồi xoá bộ nhớ dưới đây. Khi
 * ấy đây là file duy nhất phải sửa: {@link NotificationCenterGateway} không đổi
 * một dòng nào, và `useNotificationCenter` cũng vậy.
 *
 * ## Vì sao thông báo mới đi vào bằng {@link pushNotification} chứ không bằng SSE
 *
 * Đặc tả cấm màn tự mở kết nối riêng, và kênh có sẵn cũng không chở được:
 * `createEventChannel` (`lib/realtime/eventChannel.ts:18-21`) khoá cứng
 * `ChannelEvent = { type: 'progress'; data: Progress }` và phân tích gói tin
 * bằng `ProgressSchema.strict`. Nên hôm nay nguồn duy nhất của một thông báo mới
 * là cửa dưới đây, và test/story là những người gọi nó. Sản phẩm không gọi.
 *
 * ## Vì sao bảng đích nằm ở đây
 *
 * "Mọi thông báo phải dẫn tới một đối tượng cụ thể" là cấm tuyệt đối của màn.
 * Cách giữ lời hứa đó bằng cấu trúc — thay vì bằng trí nhớ của người viết mục
 * tiếp theo — là để {@link resolveNotificationTo} là **con đường duy nhất** dựng
 * `target.to`, và để nó không có nhánh nào trả về `ROUTES.dashboard`.
 */

import { formatTimestamp } from '@/lib/format/datetime';
import { ROUTES } from '@/routes/paths';

import type {
  NotificationCenterGateway,
  NotificationItemVm,
  NotificationTarget,
} from './notificationModel';

/* -------------------------------------------------------------------------- */
/* 1 — Bảng đích: mỗi thông báo dẫn tới màn duyệt của chính nó                 */
/* -------------------------------------------------------------------------- */

/**
 * Những nơi một thông báo được phép dẫn tới.
 *
 * Đây là bảng điều hướng của đặc tả viết thành một union: sáu nơi đầu là màn
 * duyệt theo tầng, ba nơi cuối theo dự án. Không có mục nào cho bảng điều khiển,
 * và đó là chủ ý — "dẫn về dashboard cho chắc" là đúng thứ mà cấm tuyệt đối của
 * màn này nói không.
 */
export const NOTIFICATION_PLACES = [
  'walls',
  'objects',
  'dimensions',
  'grids',
  'rooms',
  'thickness',
  'floors',
  'rules',
  'projectSettings',
] as const;

export type NotificationPlace = (typeof NOTIFICATION_PLACES)[number];

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
 * Xuất khẩu để story và bài kiểm dựng mục mẫu bằng CÙNG bảng đích mà bộ mẫu dưới
 * đây dùng — một bản đích thứ hai gõ tay sẽ lệch đúng vào lúc `ROUTES` đổi.
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
/* 2 — Bộ mẫu của khoản nợ T-09                                                */
/* -------------------------------------------------------------------------- */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Thứ {@link buildSeedItem} nhận: mọi thứ trừ `relativeTime`, thứ được dựng ra. */
interface SeedInput extends Omit<NotificationItemVm, 'relativeTime' | 'target'> {
  readonly target: NotificationTargetInput;
}

/**
 * `relativeTime` của cổng là giá trị **mồi**, không phải giá trị cuối.
 *
 * Chỉ `useNotificationCenter` mới có đồng hồ tiêm vào (`options.now`, cho
 * `fakeClock`), nên nó dựng lại chuỗi này bằng `formatTimestamp(createdAt, now)`
 * ở mỗi lượt render. Trường vẫn được đổ đầy ở đây vì hợp đồng khai nó là bắt
 * buộc, và một mục đọc thẳng từ cổng — trong một story không qua hook — vẫn phải
 * đọc được.
 */
function buildSeedItem(seed: SeedInput, nowMs: number): NotificationItemVm {
  return {
    id: seed.id,
    kind: seed.kind,
    sentence: seed.sentence,
    target: createNotificationTarget(seed.target),
    createdAt: seed.createdAt,
    relativeTime: formatTimestamp(seed.createdAt, nowMs),
    isRead: seed.isRead,
    excerpt: seed.excerpt,
    inlineAction: seed.inlineAction,
  };
}

/**
 * Bộ mẫu: bảy mục trải trên bốn ngày và cả bốn loại.
 *
 * Mốc thời gian tính LÙI từ `nowMs` chứ không phải hằng số tuyệt đối, để bộ mẫu
 * không tự già đi thành "03/08/2026" sau vài tuần và nhóm "Hôm nay" không rỗng
 * trong story.
 *
 * `excerpt` chỉ có ở `commentMention` — cấm tuyệt đối của màn, và đây là chỗ nó
 * được giữ trong dữ liệu chứ không chỉ trong lời hứa.
 */
function createSeedItems(nowMs: number): readonly NotificationItemVm[] {
  const seeds: readonly SeedInput[] = [
    {
      id: 'ntf-walls-01',
      kind: 'aiCompleted',
      sentence: 'đã dò xong tường tầng 3 của Chung cư Thảo Điền, mời bạn duyệt.',
      target: {
        place: 'walls',
        projectId: 'prj-thao-dien',
        projectName: 'Chung cư Thảo Điền',
        floorId: 'floor-03',
        label: 'tường tầng 3',
      },
      createdAt: nowMs - 40 * 1000,
      isRead: false,
      excerpt: undefined,
      inlineAction: { label: 'xem kết quả', kind: 'navigate' },
    },
    {
      id: 'ntf-mention-01',
      kind: 'commentMention',
      sentence:
        'Trần Minh Khoa nhắc bạn trong một bình luận ở phòng khách tầng 2, Nhà phố Nguyễn Huệ.',
      target: {
        place: 'rooms',
        projectId: 'prj-nguyen-hue',
        projectName: 'Nhà phố Nguyễn Huệ',
        floorId: 'floor-02',
        label: 'phòng khách tầng 2',
      },
      createdAt: nowMs - 18 * MINUTE_MS,
      isRead: false,
      excerpt:
        'chỗ này bề dày tường đang là 220 nhưng bản vẽ gốc ghi 200, bạn xem lại giúp mình nhé.',
      inlineAction: { label: 'xem bình luận', kind: 'navigate' },
    },
    {
      id: 'ntf-violation-01',
      kind: 'violationFound',
      sentence: 'bộ luật vừa tìm thấy ba lỗi mới ở Chung cư Thảo Điền.',
      target: {
        place: 'rules',
        projectId: 'prj-thao-dien',
        projectName: 'Chung cư Thảo Điền',
        floorId: undefined,
        label: 'bảng lỗi của dự án',
      },
      createdAt: nowMs - 3 * HOUR_MS,
      isRead: false,
      excerpt: undefined,
      inlineAction: { label: 'xem lỗi', kind: 'navigate' },
    },
    {
      id: 'ntf-invite-01',
      kind: 'projectInvite',
      sentence: 'Lê Thị Hồng Ánh mời bạn tham gia dự án Văn phòng Cầu Giấy.',
      target: {
        place: 'projectSettings',
        projectId: 'prj-cau-giay',
        projectName: 'Văn phòng Cầu Giấy',
        floorId: undefined,
        label: 'Văn phòng Cầu Giấy',
      },
      createdAt: nowMs - 26 * HOUR_MS,
      isRead: false,
      excerpt: undefined,
      inlineAction: { label: 'chấp nhận', kind: 'accept' },
    },
    {
      id: 'ntf-dimensions-01',
      kind: 'aiCompleted',
      sentence: 'đã đọc xong kích thước tầng 1 của Nhà phố Nguyễn Huệ, mời bạn đối chiếu.',
      target: {
        place: 'dimensions',
        projectId: 'prj-nguyen-hue',
        projectName: 'Nhà phố Nguyễn Huệ',
        floorId: 'floor-01',
        label: 'kích thước tầng 1',
      },
      createdAt: nowMs - 30 * HOUR_MS,
      isRead: true,
      excerpt: undefined,
      inlineAction: { label: 'xem kết quả', kind: 'navigate' },
    },
    {
      id: 'ntf-grids-01',
      kind: 'aiCompleted',
      sentence: 'đã dò xong trục tầng 2 của Văn phòng Cầu Giấy, mời bạn duyệt.',
      target: {
        place: 'grids',
        projectId: 'prj-cau-giay',
        projectName: 'Văn phòng Cầu Giấy',
        floorId: 'floor-02',
        label: 'trục tầng 2',
      },
      createdAt: nowMs - 3 * DAY_MS,
      isRead: true,
      excerpt: undefined,
      inlineAction: { label: 'xem kết quả', kind: 'navigate' },
    },
    {
      id: 'ntf-thickness-01',
      kind: 'aiCompleted',
      sentence: 'đã chuẩn hoá bề dày tường tầng 3 của Chung cư Thảo Điền, mời bạn duyệt.',
      target: {
        place: 'thickness',
        projectId: 'prj-thao-dien',
        projectName: 'Chung cư Thảo Điền',
        floorId: 'floor-03',
        label: 'bề dày tường tầng 3',
      },
      createdAt: nowMs - 4 * DAY_MS,
      isRead: true,
      excerpt: undefined,
      inlineAction: { label: 'xem kết quả', kind: 'navigate' },
    },
  ];

  return seeds.map((seed) => buildSeedItem(seed, nowMs));
}

/* -------------------------------------------------------------------------- */
/* 3 — Bộ nhớ tạm của khoản nợ T-09                                            */
/* -------------------------------------------------------------------------- */

/** Một người dùng một hộp, vì màn này chỉ nói về người đang đăng nhập. */
let storedItems: readonly NotificationItemVm[] = createSeedItems(Date.now());

/**
 * Người nghe của {@link NotificationCenterGateway.subscribe}.
 *
 * Ở tầm module chứ không trong bao đóng của factory: hook dựng cổng đúng một lần
 * bằng `useState(() => …)`, nhưng story dựng nhiều bản, và một thông báo đẩy vào
 * phải tới được mọi bản đang mở — cùng lý lẽ giữ `storedItems` ở đây.
 */
const listeners = new Set<(arrived: NotificationItemVm) => void>();

/**
 * Cổng thật của ứng dụng.
 *
 * Trả về `Promise` chứ không phải giá trị đồng bộ, và đó là chủ ý: `useQuery`
 * phải có một lượt "đang tải" thật để trạng thái 2 của A11 không phải là thứ chỉ
 * tồn tại trong story. Khi T-09 nối dây thật, chữ ký này không đổi.
 */
export function createNotificationCenterGateway(): NotificationCenterGateway {
  return {
    list: () => Promise.resolve(storedItems),
    markRead: (ids) => {
      const wanted = new Set(ids);
      storedItems = storedItems.map((item) =>
        wanted.has(item.id) ? { ...item, isRead: true } : item,
      );

      return Promise.resolve();
    },
    markAllRead: () => {
      storedItems = storedItems.map((item) => (item.isRead ? item : { ...item, isRead: true }));

      return Promise.resolve();
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Đẩy một thông báo mới vào. Dành cho test và story; sản phẩm không gọi.
 *
 * Đây là thứ thay chỗ kênh thời gian thực cho tới khi T-09 nối dây: mục được ghi
 * vào bộ nhớ ở ĐẦU danh sách (mới nhất trước) rồi phát cho mọi người nghe, đúng
 * thứ tự một máy chủ thật sẽ làm.
 */
export function pushNotification(item: NotificationItemVm): void {
  storedItems = [item, ...storedItems];

  for (const listener of listeners) {
    listener(item);
  }
}

/** Đưa bộ nhớ tạm về bộ mẫu và gỡ mọi người nghe. Dành cho test; sản phẩm không gọi. */
export function resetNotificationCenterStore(nowMs: number = Date.now()): void {
  storedItems = createSeedItems(nowMs);
  listeners.clear();
}

/** Xoá sạch hộp thư, cho story dựng trạng thái 1 (rỗng). Sản phẩm không gọi. */
export function clearNotificationCenterStore(): void {
  storedItems = [];
}
