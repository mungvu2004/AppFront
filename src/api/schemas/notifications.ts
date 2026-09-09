import { z } from 'zod';

/**
 * Hợp đồng dây của trung tâm thông báo — T-09.
 *
 * ## Vì sao bốn mã loại được khai LẠI ở đây, không nhập từ màn
 *
 * `NOTIFICATION_KINDS` đã có một bản khai tại
 * `src/screens/system/NotificationCenter/notificationModel.ts`, nhưng mục 0.4
 * cấm mọi tầng — kể cả `src/api` — phụ thuộc `src/screens`: màn là tầng TRÊN
 * CÙNG, được phép đọc mọi tầng dưới nó, không có chiều ngược lại. Nên bốn
 * chuỗi được khai lại ở đây, cùng khuôn `LIBRARY_GROUPS` (`./library.ts`) đã
 * đi trước cho đúng lý do: không có kiểu nào ở `src/domain`/`src/types` để
 * `satisfies` chống trôi, nên mảng ở MỖI tầng tự là nguồn của chính tầng đó.
 *
 * ## `message` mang cả câu, `objectLabel` chỉ mang tên đối tượng
 *
 * `message` là câu tiếng Việt ĐÃ GHÉP xong ở máy chủ ("AI đã xử lý xong bản vẽ
 * tầng trệt") — dựng một câu đúng ngữ pháp cho bốn loại khác nhau là việc của
 * nơi biết đủ ngữ cảnh, không phải việc suy luận lại ở client.
 * `projectId`/`projectName`/`floorId`/`objectLabel` đi kèm RIÊNG vì chúng còn
 * một việc thứ hai: đó là nguyên liệu để tầng trên dựng `NotificationTarget`
 * (đường dẫn, chữ hiển thị của liên kết) — phần điều hướng của một mục, khác
 * hẳn phần câu chữ hiển thị của nó.
 *
 * ## Vắng `floorId`/`excerpt` là vắng trường, không phải chuỗi rỗng
 *
 * Một `projectInvite` không trỏ tới tầng nào cả, và chỉ `commentMention` mới
 * có trích đoạn — cùng lý lẽ đã ghi cho `measurement` trong `./quality.ts`: một
 * chuỗi rỗng là giá trị hợp lệ ở nơi khác, lấy nó làm canh gác thì màn không
 * phân biệt được "không có" với "có nhưng rỗng".
 *
 * ## `place` là DỮ LIỆU, không phải thứ client suy ra từ `kind`
 *
 * Bản đầu của lược đồ này không có `place`, và lượt nối dây phát hiện ra rằng
 * không có nó thì `kind` không đủ để trả lời "bấm vào thì đi đâu":
 * `violationFound` → `rules` và `projectInvite` → `projectSettings` thì suy
 * được, nhưng một `aiCompleted` có thể là tường, trục, kích thước hay bề dày —
 * bốn màn duyệt khác nhau — và `commentMention` cũng vậy. Đoán ở client là dựng
 * một liên kết SAI mà không ai thấy sai: nó vẫn mở ra một màn, chỉ là không
 * phải màn người dùng được hứa. "Mọi thông báo phải dẫn tới một đối tượng cụ
 * thể" là cấm tuyệt đối của màn thông báo, và dẫn nhầm chỗ vi phạm nó nặng hơn
 * là không dẫn.
 *
 * Máy chủ biết lượt chạy vừa xong ở lớp nào, nên nó nói ra. Trường này **bắt
 * buộc và không có mặc định**: một gói tin thiếu `place` bị `safeParseList`
 * loại khỏi danh sách (`client.notifications.list`), và một mục biến mất thành
 * thật hơn một mục dẫn sai chỗ.
 */

const idSchema = z.string().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Bốn loại thông báo — xem docblock đầu file cho lý do bảng này không nhập từ
 * `notificationModel.ts`.
 */
export const NOTIFICATION_KINDS = ['aiCompleted', 'violationFound', 'projectInvite', 'commentMention'] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const wireNotificationKindSchema = z.enum(NOTIFICATION_KINDS);

/**
 * Chín màn duyệt mà một thông báo được phép dẫn tới.
 *
 * Sáu tên đầu là các lớp duyệt THEO TẦNG (`ROUTES.project.walls(projectId,
 * floorId)` và anh em của nó), ba tên cuối theo DỰ ÁN. Không có mục nào cho
 * bảng điều khiển, và đó là chủ ý: "dẫn về dashboard cho chắc" là đúng thứ mà
 * cấm tuyệt đối của trung tâm thông báo nói không.
 *
 * Bảng này ở tầng `src/api` chứ không ở màn, dù chính màn là nơi đổi nó thành
 * đường dẫn: nó là một phần của HỢP ĐỒNG DÂY — máy chủ phải gửi đúng một trong
 * chín chuỗi này — nên nguồn sự thật thuộc về tầng nói chuyện với máy chủ. Màn
 * nhập lại từ đây (`notificationCenterGateway.ts`), đúng cách nó nhập
 * {@link NOTIFICATION_KINDS}; hai bản gõ tay ở hai tầng là thứ R-71 cấm.
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

const wireNotificationPlaceSchema = z.enum(NOTIFICATION_PLACES);

/* -------------------------------------------------------------------------- */
/* Một thông báo.                                                              */
/* -------------------------------------------------------------------------- */

export const NotificationSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    excerpt: z.string().min(1).optional(),
    floorId: idSchema.optional(),
    id: idSchema,
    isRead: z.boolean(),
    kind: wireNotificationKindSchema,
    message: z.string().min(1),
    objectLabel: z.string().min(1),
    place: wireNotificationPlaceSchema,
    projectId: idSchema,
    projectName: z.string().min(1),
  })
  .strict()
  .transform((wireNotification) => ({
    createdAt: wireNotification.createdAt,
    ...(wireNotification.excerpt !== undefined ? { excerpt: wireNotification.excerpt } : {}),
    ...(wireNotification.floorId !== undefined ? { floorId: wireNotification.floorId } : {}),
    id: wireNotification.id,
    isRead: wireNotification.isRead,
    kind: wireNotification.kind,
    message: wireNotification.message,
    objectLabel: wireNotification.objectLabel,
    place: wireNotification.place,
    projectId: wireNotification.projectId,
    projectName: wireNotification.projectName,
  }));

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationWire = z.input<typeof NotificationSchema>;

/* -------------------------------------------------------------------------- */
/* Biểu mẫu đi ra.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Đánh dấu một hoặc nhiều mục đã đọc.
 *
 * `.min(1)` trên mảng, cùng lý lẽ với `InviteUsersSchema.emails` (`./users.ts`):
 * một request không mang id nào là một lượt gọi sai chỗ, không phải "đánh dấu
 * không gì cả". "Tất cả" có đường riêng của nó — `ENDPOINTS.notifications.markAllRead`
 * — không phải mảng này bỏ trống.
 */
export const MarkNotificationsReadSchema = z
  .object({
    ids: z.array(idSchema).min(1),
  })
  .strict();

export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadSchema>;
