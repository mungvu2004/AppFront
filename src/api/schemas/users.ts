import { z } from 'zod';

import type { ProjectRole } from '@/types/project';

/**
 * Hợp đồng dây của phần quản trị người dùng — T-04.
 *
 * Cùng khuôn với `./index.ts`, `./quality.ts` và `./library.ts`: mỗi schema là
 * một `z.object().strict()` kèm `.transform()`, `Xxx` là hình dạng đã giải mã
 * và `XxxWire` là hình dạng đi trên dây. Tách ra file riêng vì cùng một lý do
 * hai file kia được tách: đây là nhóm mượn một kiểu của tầng khác —
 * `ProjectRole` của `src/types` — và ranh giới ấy đáng nhìn thấy ở đầu một
 * file thay vì lẫn vào giữa `index.ts`.
 *
 * ## `AdminUserSchema` KHÔNG thay `UserSchema`, nó đứng cạnh
 *
 * `UserSchema` (`./index.ts`) mang đúng năm trường mà `ProjectSchema.members`
 * cần: ai là thành viên của dự án này, tên gì, vai gì. Màn quản trị hỏi một câu
 * khác — "người này đang ở trạng thái nào trong cả hệ thống" — nên nó cần thêm
 * `status`, `lastActiveAt`, `projectCount` và hai mốc thời gian của lời mời.
 * Nhồi năm trường ấy vào `UserSchema` thì mọi `ProjectSchema` đi trên dây phải
 * mang theo chúng cho từng thành viên, hoặc phải khai chúng optional và thế là
 * không schema nào còn nói được cái gì bắt buộc. Hai lượt đọc khác nhau, hai
 * schema.
 *
 * ## Ba vai, và file này không được phép có vai thứ tư
 *
 * `ProjectRole` (`src/types/project.ts`) là nguồn DUY NHẤT của tập vai, và
 * {@link projectRoleByWire} khai kiểu `Record<ProjectRole, ProjectRole>` nên
 * một vai thêm vào miền làm file này KHÔNG biên dịch được nữa — đúng cái ta
 * muốn: người thêm vai phải đi qua đây, không lặng lẽ để một vai lạ rơi qua
 * `z.enum` rồi vào màn. Bảng là ánh xạ đồng nhất, cùng hình dạng và cùng lý do
 * với `progressStatusByWire` trong `./index.ts`: nó tồn tại để một giá trị lạ
 * trên dây dừng lại ở tầng này.
 *
 * ## Vắng thông tin biểu diễn bằng vắng trường — trừ `lastActiveAt`
 *
 * `invitedAt` và `inviteExpiresAt` chỉ có mặt trên một người `'pending'`: một
 * người đã kích hoạt tài khoản thì lời mời của họ không còn là sự thật nào cả,
 * và giữ lại hai mốc ấy là mời màn hiện một chấm "lời mời hết hạn" cho người
 * đang dùng sản phẩm bình thường. Cặp trường ấy là thứ cho nút "gửi lại" một lý
 * do xuất hiện: hết hạn thì gửi lại, chưa hết hạn thì chưa cần.
 *
 * `lastActiveAt` thì ngược lại — `null` chứ không vắng mặt. "Chưa từng hoạt
 * động" là một câu trả lời có thật và màn phải in nó ra thành chữ ("chưa hoạt
 * động lần nào"), khác hẳn "máy chủ không gửi trường này". Một người vừa nhận
 * lời mời luôn ở đúng trạng thái ấy, nên nó là ca thường chứ không phải ca lạ.
 *
 * ## `objectCode` là mã, `objectLabel` là chữ
 *
 * Một dòng hoạt động trỏ tới một đối tượng — trục `A-3`, phòng `P.201`. Mã đi
 * riêng khỏi nhãn vì màn hiện mã bằng chữ đều (A6 cho phép chữ hoa đúng ở mã
 * trục và mã lỗi) còn nhãn thì viết thường kiểu câu. Gộp làm một chuỗi thì tầng
 * trình bày không tách lại được.
 *
 * ## Ba schema cuối đi RA, không đi vào
 *
 * `InviteUsersSchema`, `RoleChangeSchema` và `RemoveUserSchema` kiểm một biểu
 * mẫu TRƯỚC khi nó được phép thành một request — cùng vai trò với `SignInSchema`
 * và `DrawingCornersInputSchema`, nên chúng không có `.transform()`: không có
 * hình dạng dây nào để quy đổi, thứ đi ra chính là thứ vừa được kiểm.
 * `RemoveUserSchema.confirmEmail` là địa chỉ người duyệt phải gõ lại — A9 nói
 * hành động không hoàn tác được phải hỏi trước, và đây là câu hỏi ấy ở dạng dữ
 * liệu.
 *
 * ## Vì sao các schema lá được khai lại ở đây thay vì nhập từ `./index.ts`
 *
 * `./index.ts` kết thúc bằng `export * from './users'`, nên một dòng
 * `import { EmailSchema } from './index'` ở đây là một VÒNG IMPORT — đã đo, không
 * đoán: `npx eslint src/api --rule import/no-cycle` báo đúng hai lỗi ở
 * `index.ts` và ở dòng nhập ấy. R-05 giữ repo ở con số 0 vòng và cổng
 * `pnpm cycles` chặn thật, nên đường đó đóng.
 *
 * `./library.ts` và `./quality.ts` đã gặp đúng chuyện này và đã chọn đúng lối
 * ra: mỗi file khai lấy các schema LÁ của mình (`idSchema` xuất hiện nguyên văn
 * ở cả hai). Chúng là lá theo nghĩa chặt — `z.string().min(1)` không mang quyết
 * định nghiệp vụ nào để trôi đi. {@link emailSchema} bên dưới giữ NGUYÊN thứ tự
 * `.min(1)` trước `.email()` của `EmailSchema`, và thứ tự ấy mới là phần mang
 * thông tin: zod báo lỗi theo thứ tự khai, nên ô trống cho ra "chưa nhập" trước
 * "sai dạng". Chép sai thứ tự là đổi câu người dùng đọc.
 */

const idSchema = z.string().min(1);
const isoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Địa chỉ thư, cùng luật và cùng THỨ TỰ với `EmailSchema` (`./index.ts`).
 *
 * `.min(1)` đứng trước `.email()` có chủ đích — xem docblock đầu file.
 */
const emailSchema = z.string().min(1).email();

/** Số nguyên không âm — dùng cho số dự án một người đang tham gia. */
const nonNegativeIntegerSchema = z.number().int().nonnegative();

/* -------------------------------------------------------------------------- */
/* Vai và trạng thái.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Ba vai, đọc thẳng từ `ProjectRole`.
 *
 * `as const satisfies readonly ProjectRole[]` chứ không một union viết tay:
 * một chuỗi lạ ở đây là lỗi biên dịch ngay tại dòng này. Cùng khuôn với
 * `AUTH_ROLES` (`src/lib/auth/permissions.ts`), vốn khai đúng ba giá trị này
 * theo đúng cách ấy.
 */
export const ADMIN_USER_ROLES = ['admin', 'engineer', 'viewer'] as const satisfies readonly ProjectRole[];

/**
 * Ba trạng thái tài khoản.
 *
 * `'pending'` là đã mời chưa nhận, `'disabled'` là bị vô hiệu — KHÔNG phải bị
 * xoá. Hai thứ đó khác nhau ở chỗ một cái hoàn tác được (A8) còn cái kia thì
 * không, và đó là lý do màn có cả nút "vô hiệu" lẫn hộp thoại xoá riêng (A9).
 */
export const ADMIN_USER_STATUSES = ['active', 'pending', 'disabled'] as const;

export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

/**
 * Ánh xạ đồng nhất, khai đủ ba vai.
 *
 * `satisfies Record<ProjectRole, ProjectRole>` là phần mang thông tin: thiếu
 * một vai hoặc thừa một vai đều không biên dịch, nên bảng này không thể lệch
 * khỏi `ProjectRole` mà không ai biết.
 */
const projectRoleByWire = {
  admin: 'admin',
  engineer: 'engineer',
  viewer: 'viewer',
} as const satisfies Record<ProjectRole, ProjectRole>;

const adminUserStatusByWire = {
  active: 'active',
  disabled: 'disabled',
  pending: 'pending',
} as const satisfies Record<AdminUserStatus, AdminUserStatus>;

const wireProjectRoleSchema = z.enum(ADMIN_USER_ROLES);
const wireAdminUserStatusSchema = z.enum(ADMIN_USER_STATUSES);

/* -------------------------------------------------------------------------- */
/* Một người, nhìn từ màn quản trị.                                            */
/* -------------------------------------------------------------------------- */

export const AdminUserSchema = z
  .object({
    avatarUrl: z.string().url().optional(),
    email: z.string().email(),
    id: idSchema,
    invitedAt: isoDateTimeSchema.optional(),
    inviteExpiresAt: isoDateTimeSchema.optional(),
    lastActiveAt: isoDateTimeSchema.nullable(),
    name: z.string().min(1),
    projectCount: nonNegativeIntegerSchema,
    role: wireProjectRoleSchema,
    status: wireAdminUserStatusSchema,
  })
  .strict()
  .transform((wireUser) => ({
    ...(wireUser.avatarUrl !== undefined ? { avatarUrl: wireUser.avatarUrl } : {}),
    email: wireUser.email,
    id: wireUser.id,
    ...(wireUser.inviteExpiresAt !== undefined ? { inviteExpiresAt: wireUser.inviteExpiresAt } : {}),
    ...(wireUser.invitedAt !== undefined ? { invitedAt: wireUser.invitedAt } : {}),
    lastActiveAt: wireUser.lastActiveAt,
    name: wireUser.name,
    projectCount: wireUser.projectCount,
    role: projectRoleByWire[wireUser.role],
    status: adminUserStatusByWire[wireUser.status],
  }));

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserWire = z.input<typeof AdminUserSchema>;

/**
 * Cả trang danh sách: những người đọc được, cộng tổng số.
 *
 * `total` đi riêng khỏi `users.length` vì hai con số ấy có thể khác nhau ngay
 * lượt đọc đầu tiên — một trang không phải cả bảng. Màn cần `total` để nói
 * "đang hiện 20 trên 137" mà không phải tải cả 137 dòng về đếm.
 */
export const AdminUserListSchema = z
  .object({
    total: nonNegativeIntegerSchema,
    users: z.array(AdminUserSchema),
  })
  .strict()
  .transform((wireList) => ({
    total: wireList.total,
    users: wireList.users,
  }));

export type AdminUserList = z.infer<typeof AdminUserListSchema>;
export type AdminUserListWire = z.input<typeof AdminUserListSchema>;

/* -------------------------------------------------------------------------- */
/* Người này đang ở đâu, và vừa làm gì.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Một dự án người này tham gia, kèm vai TRONG dự án ấy.
 *
 * Vai ở đây không nhất thiết trùng `AdminUser.role`: một người là `engineer`
 * của hệ thống vẫn có thể chỉ được xem một dự án cụ thể. Đó là lý do trường
 * `role` lặp lại ở đây thay vì màn suy ra từ bản ghi người dùng.
 */
export const UserMembershipSchema = z
  .object({
    projectId: idSchema,
    projectName: z.string().min(1),
    role: wireProjectRoleSchema,
  })
  .strict()
  .transform((wireMembership) => ({
    projectId: wireMembership.projectId,
    projectName: wireMembership.projectName,
    role: projectRoleByWire[wireMembership.role],
  }));

export type UserMembership = z.infer<typeof UserMembershipSchema>;
export type UserMembershipWire = z.input<typeof UserMembershipSchema>;

/**
 * Một dòng nhật ký hoạt động.
 *
 * `kind` là mã việc đã làm (`'wall.edit'`, `'export.file'`) — máy đọc, câu
 * tiếng Việt là việc của tầng trình bày, đúng lý lẽ đã ghi cho
 * `ImageQualityFinding.code` trong `./quality.ts`. `at` là mốc thời gian tuyệt
 * đối; chữ "3 giờ trước" dựng ở viewmodel (A15), không ở đây và không ở view.
 */
export const UserActivitySchema = z
  .object({
    at: isoDateTimeSchema,
    id: idSchema,
    kind: z.string().min(1),
    objectCode: z.string().min(1),
    objectLabel: z.string().min(1),
  })
  .strict()
  .transform((wireActivity) => ({
    at: wireActivity.at,
    id: wireActivity.id,
    kind: wireActivity.kind,
    objectCode: wireActivity.objectCode,
    objectLabel: wireActivity.objectLabel,
  }));

export type UserActivity = z.infer<typeof UserActivitySchema>;
export type UserActivityWire = z.input<typeof UserActivitySchema>;

/* -------------------------------------------------------------------------- */
/* Ba biểu mẫu đi ra.                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mời một hoặc nhiều địa chỉ vào cùng một vai.
 *
 * `.min(1)` trên mảng: một lời mời không có địa chỉ nào là một biểu mẫu chưa
 * điền, không phải một request. Từng phần tử đi qua {@link emailSchema}, cùng
 * luật và cùng thứ tự kiểm với `EmailSchema` của màn đăng nhập — xem docblock
 * đầu file cho lý do nó được khai lại thay vì nhập vào.
 */
export const InviteUsersSchema = z
  .object({
    emails: z.array(emailSchema).min(1),
    role: wireProjectRoleSchema,
  })
  .strict();

export type InviteUsersInput = z.infer<typeof InviteUsersSchema>;

/** Đổi vai của đúng một người. Không hộp thoại — xem [CẤM] của đặc tả màn. */
export const RoleChangeSchema = z
  .object({
    role: wireProjectRoleSchema,
    userId: idSchema,
  })
  .strict();

export type RoleChangeInput = z.infer<typeof RoleChangeSchema>;

/**
 * Xoá hẳn một người.
 *
 * `confirmEmail` là địa chỉ người duyệt gõ lại để xác nhận. Nó ở tầng dữ liệu
 * chứ không chỉ ở màn vì A9 nói hành động A8 không hoàn tác được thì phải hỏi
 * trước — và một xác nhận chỉ sống trong state của màn thì bất kỳ nơi gọi nào
 * khác cũng bỏ qua được nó.
 */
export const RemoveUserSchema = z
  .object({
    confirmEmail: emailSchema,
    userId: idSchema,
  })
  .strict();

export type RemoveUserInput = z.infer<typeof RemoveUserSchema>;
