import { z } from 'zod';

import { CursorPageSchema } from './common';

/**
 * N7b — `GET /api/projects/{project_id}/pipeline-runs` (`drawings_list_pipeline_runs`,
 * UIFIX-B7): nhật ký lượt xử lý, mới nhất trước. Mỗi mục là một lượt chạy của
 * MỘT tầng. `step` + `progressPercent` cùng nghĩa với `Progress` (BE-BIND §4),
 * nên tầng trên dựng giai đoạn bằng `toStageBreakdown` như màn xử lý.
 *
 * Khoá vắng khi chưa có giá trị (W2): `startedAt`, `endedAt` (chỉ lượt
 * `completed`; lượt `failed` dừng ở `updatedAt`, K33), `errorCode`,
 * `supersededBy` (lượt bị thay: `failed` + `PIPELINE_SUPERSEDED`).
 */

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const PIPELINE_RUN_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;

export const PipelineRunSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    endedAt: isoDateTimeSchema.optional(),
    errorCode: z.string().min(1).optional(),
    floorId: z.string().min(1),
    floorName: z.string().min(1),
    progressPercent: z.number().int().min(0).max(100),
    runId: z.string().min(1),
    startedAt: isoDateTimeSchema.optional(),
    status: z.enum(PIPELINE_RUN_STATUSES),
    step: z.string().min(1),
    supersededBy: z.string().min(1).optional(),
    updatedAt: isoDateTimeSchema,
    uploadId: z.string().min(1),
  })
  .strict();

export type PipelineRun = z.infer<typeof PipelineRunSchema>;

export const PipelineRunPageSchema = CursorPageSchema(PipelineRunSchema);

export type PipelineRunPage = z.infer<typeof PipelineRunPageSchema>;

/** Trần `limit` của N7b và của `notifications_list` (`NOTIFICATIONS_LIST_MAX`). */
export const PIPELINE_RUNS_LIST_MAX = 200;
