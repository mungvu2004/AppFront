import { z } from 'zod';

/**
 * N3, N4 — thêm và gỡ thành viên dự án (HOP-DONG-MOI §2).
 *
 * Chỉ thân của N3 có schema ở đây. Response của cả N3 lẫn N4 là `UserSchema`
 * cũ (`./index.ts`), và N4 (`DELETE …/members/{user_id}`) không có thân. N2
 * (danh sách thành viên riêng) để v2 — F-07 đọc thành viên từ `Project.members`.
 */

/** `.min(1)` trước `.email()`: ô trống báo "chưa nhập" trước "sai dạng" (`./index.ts`, `EmailSchema`). */
const emailSchema = z.string().min(1).email();

/** N3. Người `pending` vẫn thêm được; tài khoản không có hoặc bị vô hiệu → 422 `MEMBER_USER_UNAVAILABLE`. */
export const AddProjectMemberSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type AddProjectMember = z.infer<typeof AddProjectMemberSchema>;
