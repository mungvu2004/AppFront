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
