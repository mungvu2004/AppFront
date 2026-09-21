import { z } from 'zod';

/**
 * N8–N10 — quên mật khẩu và nhận lời mời (HOP-DONG-MOI §3). Ba đường công
 * khai, có rate limit; cả ba trả 204 nên chỉ thân gửi có schema.
 *
 * Mảnh lá khai lại tại chỗ thay vì nhập `EmailSchema`/`PasswordSchema` của
 * `./index.ts`: file mới không nhập `./index` (HOP-DONG-MOI §0). Thứ tự kiểm
 * giữ nguyên khuôn ấy — `.min(1)` trước, để ô trống báo "chưa nhập" trước "sai
 * dạng" hay "quá ngắn".
 */

const emailSchema = z.string().min(1).email();
const passwordSchema = z.string().min(1).min(8);
const tokenSchema = z.string().min(1).max(512);

/** N8 — luôn 204, kể cả khi địa chỉ không có tài khoản (C27). */
export const PasswordResetRequestSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

/** N9 — token sai hoặc hết hạn → 422 `PASSWORD_RESET_TOKEN_INVALID`. */
export const PasswordResetConfirmSchema = z
  .object({
    newPassword: passwordSchema,
    token: tokenSchema,
  })
  .strict();

export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

/**
 * N10 — đường vào duy nhất cho người mới (K7: không có đăng ký công khai).
 *
 * `fullName` trim **trước** khi đo, nên một tên toàn dấu cách là tên chưa nhập,
 * và dây mang đúng bản đã trim (khuôn `FullNameSchema` của `./index.ts`). Trần
 * 120 là của `MeSchema.fullName`: tên nhận ở đây chính là tên N11 trả về.
 */
export const AcceptInvitationSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    password: passwordSchema,
    token: tokenSchema,
  })
  .strict();

export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;
