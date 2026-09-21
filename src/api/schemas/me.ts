import { z } from 'zod';

/**
 * N11–N14 — hồ sơ của người đang đăng nhập (HOP-DONG-MOI §3).
 *
 * Chỉ hồ sơ. Giao diện và tuỳ chọn thông báo vẫn nằm trong bộ nhớ ở v1 (AC1),
 * nên không có trường nào cho chúng ở đây.
 *
 * ## Trim: bản gửi tự cắt, bản nhận không kiểm
 *
 * `UpdateMeSchema.fullName` `.trim()` trước khi đo: người gõ thừa dấu cách
 * không phải lỗi, và dây mang đúng bản máy chủ sẽ lưu.
 *
 * `MeSchema.fullName` **không** kiểm "đã trim", và cũng không tự cắt. BE lưu
 * `nfc(strip)` (`B1-04.md:70`) — `strip()` của Python không cắt U+FEFF, còn
 * `trim()` của JS thì cắt; U+FEFF (Cf) cũng không nằm trong danh sách ký tự BE
 * chặn (`B1-03.md:35`). Refine theo `trim()` sẽ báo động giả trên một tên BE
 * trả đúng đặc tả, và vì N11 là object đơn, báo động giả là hỏng cả màn tài
 * khoản. Lời hứa kiểu này của máy chủ không vào zod (HOP-DONG-MOI §0.2 B).
 */

export const ACCOUNT_LANGUAGES = ['vi', 'en'] as const;

export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/**
 * Trần độ dài của ảnh đại diện sau khi mã hoá base64: ≈ 512 KiB khi giải mã
 * (AC2). `.max()` cho `path: ['contentBase64']` mà không cần refine riêng.
 */
const AVATAR_BASE64_MAX_LENGTH = 699_052;

const languageSchema = z.enum(ACCOUNT_LANGUAGES);
const passwordSchema = z.string().min(1).min(8);

export const MeSchema = z
  .object({
    avatarUrl: z.string().url().optional(),
    email: z.string().email(),
    fullName: z.string().min(1).max(120),
    jobTitle: z.string().min(1).max(120).optional(),
    language: languageSchema,
    phone: z.string().min(1).max(32).optional(),
  })
  .strict()
  .transform((wireMe) => ({
    ...(wireMe.avatarUrl !== undefined ? { avatarUrl: wireMe.avatarUrl } : {}),
    email: wireMe.email,
    fullName: wireMe.fullName,
    ...(wireMe.jobTitle !== undefined ? { jobTitle: wireMe.jobTitle } : {}),
    language: wireMe.language,
    ...(wireMe.phone !== undefined ? { phone: wireMe.phone } : {}),
  }));

export type Me = z.infer<typeof MeSchema>;

/**
 * N12. `jobTitle` và `phone` nhận `''` — đó là lệnh **xoá**, nên không có
 * `.min(1)` như bản nhận.
 */
export const UpdateMeSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    jobTitle: z.string().max(120).optional(),
    language: languageSchema.optional(),
    phone: z.string().max(32).optional(),
  })
  .strict()
  .refine(
    /*
     * Đếm **giá trị**, không đếm khoá: zod 3 giữ khoá mang `undefined`, nên
     * `Object.keys(body).length > 0` cho `{ fullName: undefined }` lọt rồi
     * `JSON.stringify` gửi đi đúng `{}`. `''` là một giá trị, nên
     * `{ phone: '' }` đạt.
     */
    (body) =>
      body.fullName !== undefined ||
      body.jobTitle !== undefined ||
      body.language !== undefined ||
      body.phone !== undefined,
    { path: [] },
  );

export type UpdateMe = z.infer<typeof UpdateMeSchema>;

/** N13. Sai mật khẩu hiện tại → 422 `CURRENT_PASSWORD_INCORRECT`, không 401 (W10). */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  })
  .strict();

export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

/** N14. Kích thước ảnh > 4096×4096 thì BE trả 422 — zod không đo được điều đó. */
export const UploadAvatarSchema = z
  .object({
    contentBase64: z.string().max(AVATAR_BASE64_MAX_LENGTH),
    mimeType: z.enum(AVATAR_MIME_TYPES),
  })
  .strict();

export type UploadAvatar = z.infer<typeof UploadAvatarSchema>;
