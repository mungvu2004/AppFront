import { z } from 'zod';

import { CursorPageSchema, isoInstantSchema } from './common';

/**
 * N1 — `GET /api/project-summaries`: một thẻ dự án của dashboard.
 *
 * Đặc tả trường ở HOP-DONG-MOI §2 N1. Nơi dùng (F-07) nhập thẳng
 * `@/api/schemas/projectSummaries`, không qua `./index.ts`.
 *
 * ## Không lên dây
 *
 * `planVariant` (FE suy từ băm `id`) và `initials` (FE dựng từ `name`) không có
 * ở đây — thêm chúng là thêm trường mà §2 đã cố ý bỏ.
 *
 * ## Kiểm ở đây và không kiểm ở đây
 *
 * Ba luật giữa các trường nằm trong zod (§0.2 bảng A). `areaM2` làm tròn hai
 * chữ số **không** — đó là H1 ngữ cảnh (§0.2 bảng B), runner B0-07 kiểm trên
 * mẫu golden.
 */

export const PROJECT_SUMMARY_STATUSES = ['processing', 'qc', 'done'] as const;

const projectIdSchema = z.string().regex(/^prj_[0-9A-HJKMNP-TV-Z]{26}$/);
const userIdSchema = z.string().regex(/^usr_[0-9A-HJKMNP-TV-Z]{26}$/);
const countSchema = z.number().int().nonnegative();

/**
 * Mã tầng: chuỗi không rỗng, không regex — cùng luật với `entityId` của
 * `./spatial.ts` (HOP-DONG-MOI §0.1). Không gán nhãn `LevelId`: dashboard chỉ
 * đặt nó vào đường `/floors/:floorId/…`, và `DashboardProject.defaultFloorId`
 * là `string`; còn `LevelId` là `` `L-${string}` `` (`domain/spatial/types.ts:68`),
 * gán nhãn là khẳng định một tiền tố mà §0.1 không đòi.
 */
const floorIdSchema = z.string().min(1);

/**
 * Tên dự án, 3–80 (`domain/project/limits.ts`).
 *
 * **Không** kiểm "đã trim", và cũng không tự cắt: chuỗi ra đúng như trên dây.
 * Trim là việc của BE khi ghi (`B2-01.md:36-37`), nhưng BE cắt bằng `strip()`
 * của Python, còn `trim()` của JS cắt thêm U+FEFF — ký tự Cf, không nằm trong
 * danh sách BE chặn (`B2-01.md:40`). Refine `name === name.trim()` sẽ báo động
 * giả trên một tên mà BE làm đúng đặc tả vẫn trả, và mục hỏng là một dự án
 * biến khỏi dashboard. Lời hứa kiểu này của máy chủ không vào zod
 * (HOP-DONG-MOI §0.2 B).
 */
const projectNameSchema = z.string().min(3).max(80);

export const ProjectSummaryMemberSchema = z
  .object({
    id: userIdSchema,
    name: z.string().min(1),
  })
  .strict()
  .transform((wireMember) => ({
    id: wireMember.id,
    name: wireMember.name,
  }));

export type ProjectSummaryMember = z.infer<typeof ProjectSummaryMemberSchema>;

export const ProjectSummarySchema = z
  .object({
    areaM2: z.number().nonnegative(),
    defaultFloorId: floorIdSchema.optional(),
    floorCount: countSchema,
    id: projectIdSchema,
    members: z.array(ProjectSummaryMemberSchema),
    name: projectNameSchema,
    status: z.enum(PROJECT_SUMMARY_STATUSES),
    updatedAt: isoInstantSchema,
    wallsReviewedCount: countSchema,
    wallsTotalCount: countSchema,
  })
  .strict()
  .refine((summary) => summary.wallsReviewedCount <= summary.wallsTotalCount, {
    path: ['wallsReviewedCount'],
  })
  .refine(
    (summary) =>
      summary.status !== 'done' ||
      (summary.wallsTotalCount > 0 && summary.wallsReviewedCount === summary.wallsTotalCount),
    { path: ['status'] },
  )
  /*
   * So **giá trị** với `undefined`, không hỏi khoá có mặt: zod 3 giữ khoá mang
   * `undefined` trên đầu ra (`alwaysSet`), nên `'defaultFloorId' in summary`
   * sẽ cho `{ floorCount: 2, defaultFloorId: undefined }` lọt.
   */
  .refine((summary) => (summary.floorCount === 0) === (summary.defaultFloorId === undefined), {
    path: ['defaultFloorId'],
  })
  .refine((summary) => summary.status !== 'qc' || summary.defaultFloorId !== undefined, {
    path: ['defaultFloorId'],
  })
  .transform((wireSummary) => ({
    areaM2: wireSummary.areaM2,
    ...(wireSummary.defaultFloorId !== undefined
      ? { defaultFloorId: wireSummary.defaultFloorId }
      : {}),
    floorCount: wireSummary.floorCount,
    id: wireSummary.id,
    members: wireSummary.members,
    name: wireSummary.name,
    status: wireSummary.status,
    updatedAt: wireSummary.updatedAt,
    wallsReviewedCount: wireSummary.wallsReviewedCount,
    wallsTotalCount: wireSummary.wallsTotalCount,
  }));

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

/** N1, `id` tăng dần. F-07 đọc tới hết `nextCursor` rồi tự sắp theo `updatedAt`. */
export const ProjectSummaryPageSchema = CursorPageSchema(ProjectSummarySchema);

export type ProjectSummaryPage = z.infer<typeof ProjectSummaryPageSchema>;
